package model

import (
	"errors"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/cachex"
	"github.com/samber/hot"
	"golang.org/x/sync/singleflight"
)

// IpGeoInfo 陌生 IP 的归属地信息，持久化在 ip_geo_infos 表（每 IP 一行）。
// 归属地数据变化极慢，查到即入库长期复用；内存热点缓存只做读加速。
type IpGeoInfo struct {
	Ip        string `json:"ip" gorm:"type:varchar(64);primaryKey"`
	Country   string `json:"country" gorm:"type:varchar(64)"`
	Region    string `json:"region" gorm:"type:varchar(64)"`
	City      string `json:"city" gorm:"type:varchar(64)"`
	Isp       string `json:"isp" gorm:"type:varchar(128)"`
	Source    string `json:"source" gorm:"type:varchar(64)"` // 命中的查询接口名，便于排查
	UpdatedAt int64  `json:"updated_at" gorm:"bigint"`
}

func (IpGeoInfo) TableName() string { return "ip_geo_infos" }

// Summary 归属地摘要一行：国家·省·市 · 运营商，空段自动跳过。
func (info *IpGeoInfo) Summary() string {
	parts := make([]string, 0, 4)
	for _, part := range []string{info.Country, info.Region, info.City, info.Isp} {
		if part != "" {
			parts = append(parts, part)
		}
	}
	return strings.Join(parts, " · ")
}

// ipGeoRefreshInterval 库内记录超过该时长视为可刷新（后台周期任务顺带更新）。
const IpGeoRefreshInterval = 30 * 24 * time.Hour

const (
	ipGeoFailureTTL    = 10 * time.Minute  // 失败哨兵只存内存：临时性质不落库
	ipGeoCacheTTL      = 10 * time.Minute  // 内存热点缓存 TTL（数据真实来源是表）
	ipGeoCacheCapacity = 10000             // 内存 LRU 容量
)

var (
	ipGeoCache     *cachex.HybridCache[IpGeoInfo]
	ipGeoCacheOnce sync.Once
	ipGeoFlight    singleflight.Group
)

func getIpGeoCache() *cachex.HybridCache[IpGeoInfo] {
	ipGeoCacheOnce.Do(func() {
		ipGeoCache = cachex.NewHybridCache[IpGeoInfo](cachex.HybridCacheConfig[IpGeoInfo]{
			Namespace: cachex.Namespace("ip_geo"),
			Redis:     common.RDB,
			RedisEnabled: func() bool {
				return common.RedisEnabled && common.RDB != nil
			},
			RedisCodec: cachex.JSONCodec[IpGeoInfo]{},
			Memory: func() *hot.HotCache[string, IpGeoInfo] {
				return hot.NewHotCache[string, IpGeoInfo](hot.LRU, ipGeoCacheCapacity).
					WithTTL(ipGeoCacheTTL).
					WithJanitor().
					Build()
			},
		})
	})
	return ipGeoCache
}

// ipGeoFailureKey 失败哨兵键：只在内存缓存，靠键前缀与成功条目区分。
func ipGeoFailureKey(ip string) string { return "failed:" + ip }

// IsPrivateOrReservedIp 内网/回环/非法 IP 不可查，直接短路。
func IsPrivateOrReservedIp(ipStr string) bool {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return true
	}
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsUnspecified()
}

// GetIpGeoInfoFromDB 从表读单个 IP 的归属地（无内存缓存路径）。
func GetIpGeoInfoFromDB(ip string) (*IpGeoInfo, error) {
	var row IpGeoInfo
	err := DB.Where("ip = ?", ip).First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

// GetCachedIpGeo 读缓存（内存热点→表），不触发外网请求。
// 表格渲染用：未命中返回 nil，前端显示「归属地未查询」。
func GetCachedIpGeo(ip string) *IpGeoInfo {
	if ip == "" || IsPrivateOrReservedIp(ip) {
		return nil
	}
	if cached, found, err := getIpGeoCache().Get(ip); err == nil && found {
		return &cached
	}
	row, err := GetIpGeoInfoFromDB(ip)
	if err != nil {
		return nil
	}
	_ = getIpGeoCache().SetWithTTL(ip, *row, ipGeoCacheTTL)
	return row
}

// GetIpGeoBatch 批量读归属地（内存热点→表 IN 查询），只读不触发外网请求。
// 返回 map 以便调用方按 IP 回填；库中不存在的 IP 不出现在结果里。
func GetIpGeoBatch(ips []string) map[string]*IpGeoInfo {
	result := make(map[string]*IpGeoInfo, len(ips))
	cache := getIpGeoCache()
	var miss []string
	for _, ip := range ips {
		if ip == "" || IsPrivateOrReservedIp(ip) {
			continue
		}
		if cached, found, err := cache.Get(ip); err == nil && found {
			copied := cached
			result[ip] = &copied
		} else {
			miss = append(miss, ip)
		}
	}
	if len(miss) == 0 {
		return result
	}
	var rows []IpGeoInfo
	if err := DB.Where("ip IN ?", miss).Find(&rows).Error; err != nil {
		common.SysError(common.LogText("failed to load ip geo batch: %s", err.Error()))
		return result
	}
	for i := range rows {
		row := rows[i]
		result[row.Ip] = &row
		_ = cache.SetWithTTL(row.Ip, row, ipGeoCacheTTL)
	}
	return result
}

// LookupIpGeoWithCache 完整查询链：内存热点→表→singleflight 外网查→写库。
// 表内记录超过 ipGeoRefreshInterval 时预取路径会调 refreshFn 刷新（refreshFn 为 nil 时跳过刷新）。
// 失败哨兵 10 分钟内不重试（防反复打挂的接口）。
func LookupIpGeoWithCache(ip string, lookupFn func(ip string) (*IpGeoInfo, error)) (*IpGeoInfo, error) {
	if ip == "" || IsPrivateOrReservedIp(ip) {
		return nil, errors.New("private or reserved ip")
	}
	cache := getIpGeoCache()

	if cached, found, err := cache.Get(ip); err == nil && found {
		return &cached, nil
	}
	if _, found, err := cache.Get(ipGeoFailureKey(ip)); err == nil && found {
		return nil, errors.New("recent lookup failed (cached)")
	}
	if lookupFn == nil {
		return nil, errors.New("not cached")
	}

	v, err, _ := ipGeoFlight.Do(ip, func() (any, error) {
		// double-check：进 singleflight 等待期间可能已被并发者写库/写缓存。
		if cached, found, err := cache.Get(ip); err == nil && found {
			return &cached, nil
		}
		var existing IpGeoInfo
		dbErr := DB.Where("ip = ?", ip).First(&existing).Error
		if dbErr == nil {
			_ = cache.SetWithTTL(ip, existing, ipGeoCacheTTL)
			return &existing, nil
		}
		info, err := lookupFn(ip)
		if err != nil {
			_ = cache.SetWithTTL(ipGeoFailureKey(ip), IpGeoInfo{Ip: ip}, ipGeoFailureTTL)
			return nil, err
		}
		if err := UpsertIpGeo(info); err != nil {
			// 写库失败不阻断返回：本次进程内仍有缓存可用。
			common.SysError(common.LogText("failed to persist ip geo: %s", err.Error()))
		}
		_ = cache.SetWithTTL(ip, *info, ipGeoCacheTTL)
		return info, nil
	})
	if err != nil {
		return nil, err
	}
	return v.(*IpGeoInfo), nil
}

// UpsertIpGeo 按 IP 写入或更新归属地记录。
func UpsertIpGeo(info *IpGeoInfo) error {
	if info == nil || info.Ip == "" {
		return errors.New("empty ip geo info")
	}
	info.UpdatedAt = time.Now().Unix()
	return DB.Save(info).Error
}

// GetStaleIpGeoIps 找出表内超过 ipGeoRefreshInterval 未刷新的 IP（分页取，供后台刷新任务用）。
func GetStaleIpGeoIps(before int64, limit int) ([]string, error) {
	if limit <= 0 {
		limit = 100
	}
	var ips []string
	err := DB.Model(&IpGeoInfo{}).
		Where("updated_at < ?", before).
		Order("updated_at ASC").
		Limit(limit).
		Pluck("ip", &ips).Error
	return ips, err
}
