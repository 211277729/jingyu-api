package model

import (
	"os"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// VisitDayLocation 东八区：访客看的是"自然天"，不随服务器时区漂移。
var VisitDayLocation = time.FixedZone("CST", 8*3600)

// VisitDayFormat VisitLog.Day 的日期格式。
const VisitDayFormat = "2006-01-02"

// VisitDedupeWindow 同一访客（登录用户或同一 IP）在该时间窗内的重复页面导航
// 不再记录，防止脚本/刷新行为疯狂写库。可用环境变量 VISIT_DEDUPE_WINDOW_SECONDS 覆盖。
var VisitDedupeWindow = 60 * time.Second

const (
	// visitFlushInterval 内存缓冲的落库周期。
	visitFlushInterval = 5 * time.Second
	// visitFlushBatch 缓冲超过该条数立即落库；sqlite 单条语句参数上限 999，
	// 每行 7 列，按 100 一批拆分。
	visitFlushBatch    = 200
	visitFlushSubBatch = 100
)

func init() {
	if v := os.Getenv("VISIT_DEDUPE_WINDOW_SECONDS"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			VisitDedupeWindow = time.Duration(n) * time.Second
		}
	}
}

// VisitLog 记录一次前端页面导航访问（不含 /v1 中转请求）。
// 未登录访客按 IP 记录（UserId=0），登录用户按身份记录；
// 同一访客在 VisitDedupeWindow 内的重复访问会被节流掉，明细是"去重后的访问"。
type VisitLog struct {
	Id        int    `json:"id" gorm:"primaryKey"`
	Day       string `json:"day" gorm:"type:varchar(10);index:idx_visit_day_user,priority:1"`
	UserId    int    `json:"user_id" gorm:"index:idx_visit_day_user,priority:2"`
	Username  string `json:"username" gorm:"type:varchar(64)"`
	Ip        string `json:"ip" gorm:"type:varchar(64);index"`
	Path      string `json:"path" gorm:"type:varchar(255)"`
	CreatedAt int64  `json:"created_at" gorm:"bigint"`
}

// CurrentVisitDay 返回东八区当前日期字符串。
func CurrentVisitDay() string {
	return time.Now().In(VisitDayLocation).Format(VisitDayFormat)
}

// visitBuffer 打点先落内存：节流 + 攒批，写库频率与访客刷新频率解耦。
var visitBuffer = struct {
	sync.Mutex
	pending  []VisitLog
	lastSeen map[string]int64
}{lastSeen: make(map[string]int64)}

// visitIpGeoPrefetchHook 落库后陌生 IP 归属地预取钩子。
// model 层不 import service（会循环依赖），由 service 包启动时注入回调。
var visitIpGeoPrefetchHook atomic.Value

// SetVisitIpGeoPrefetchHook 注入预取回调（service.PrefetchIpGeo），传 nil 卸载。
func SetVisitIpGeoPrefetchHook(fn func(ips []string)) {
	visitIpGeoPrefetchHook.Store(fn)
}

// visitBufferKey 访客的节流键：登录用户按身份，匿名按 IP。
func visitBufferKey(userId int, ip string) string {
	if userId > 0 {
		return "u:" + strconv.Itoa(userId)
	}
	return "i:" + ip
}

// RecordVisit 入口：节流后写入内存缓冲，由后台 goroutine 批量落库。
func RecordVisit(userId int, username, ip, path string) {
	now := time.Now()
	key := visitBufferKey(userId, ip)
	nowUnix := now.Unix()

	visitBuffer.Lock()
	if last, ok := visitBuffer.lastSeen[key]; ok && nowUnix-last < int64(VisitDedupeWindow/time.Second) {
		visitBuffer.Unlock()
		return
	}
	visitBuffer.lastSeen[key] = nowUnix
	visitBuffer.pending = append(visitBuffer.pending, VisitLog{
		Day:       now.In(VisitDayLocation).Format(VisitDayFormat),
		UserId:    userId,
		Username:  username,
		Ip:        ip,
		Path:      path,
		CreatedAt: nowUnix,
	})
	shouldFlush := len(visitBuffer.pending) >= visitFlushBatch
	visitBuffer.Unlock()

	if shouldFlush {
		FlushVisitBuffer()
	}
}

// InitVisitRecorder 启动周期性落库 goroutine（main.go 里与数据看板任务并列启动）。
func InitVisitRecorder() {
	ticker := time.NewTicker(visitFlushInterval)
	defer ticker.Stop()
	for range ticker.C {
		FlushVisitBuffer()
	}
}

// FlushVisitBuffer 把内存缓冲批量写库；写库在锁外执行，失败只记日志不丢服务。
func FlushVisitBuffer() {
	visitBuffer.Lock()
	batch := visitBuffer.pending
	visitBuffer.pending = nil
	// 顺手清掉过期的节流键，防止 map 无限增长
	cutoff := time.Now().Unix() - int64(VisitDedupeWindow/time.Second) - 1
	for k, ts := range visitBuffer.lastSeen {
		if ts < cutoff {
			delete(visitBuffer.lastSeen, k)
		}
	}
	visitBuffer.Unlock()

	if len(batch) == 0 {
		return
	}
	if err := DB.CreateInBatches(&batch, visitFlushSubBatch).Error; err != nil {
		common.SysError(common.LogText("failed to flush visits: %s", err.Error()))
		return
	}
	// 陌生 IP 丢给归属地预取（fire-and-forget，缓存命中即跳过外网请求）。
	prefetchHook := visitIpGeoPrefetchHook.Load()
	if prefetchHook != nil {
		seen := make(map[string]struct{})
		var anonymousIps []string
		for _, row := range batch {
			if row.UserId <= 0 && row.Ip != "" && !IsPrivateOrReservedIp(row.Ip) {
				if _, dup := seen[row.Ip]; !dup {
					seen[row.Ip] = struct{}{}
					anonymousIps = append(anonymousIps, row.Ip)
				}
			}
		}
		if len(anonymousIps) > 0 {
			prefetchHook.(func([]string))(anonymousIps)
		}
	}
}

// VisitSummaryItem 每位访客（登录用户或匿名 IP）在查询范围内的汇总行。
type VisitSummaryItem struct {
	VisitCount    int64  `json:"visit_count"`
	FirstVisitAt  int64  `json:"first_visit_at"`
	LastVisitAt   int64  `json:"last_visit_at"`
	UserId        int    `json:"user_id"`
	Username      string `json:"username"`
	Ip            string `json:"ip"`
	IsAnonymous   bool   `json:"is_anonymous"`
	IsNewUser     bool   `json:"is_new_user"`
	UserCreatedAt int64  `json:"user_created_at"`
	// IpGeo 陌生 IP 归属地（仅匿名行；由 controller 层从缓存读回，未命中为 nil）
	IpGeo *IpGeoInfo `json:"ip_geo,omitempty"`
}

// VisitDailyStats 查询范围内的访客构成统计。
type VisitDailyStats struct {
	TotalVisitors int `json:"total_visitors"`
	LoggedIn      int `json:"logged_in"`
	Anonymous     int `json:"anonymous"`
	NewUsers      int `json:"new_users"`
}

// GetDailyVisitSummary 查询日期范围（东八区，闭区间）内的访客汇总：
// 内存聚合（已按 VisitDedupeWindow 节流，行数量级可控），按最新访问时间倒序后分页；
// 新用户由 users.created_at 落在查询范围内判定。
func GetDailyVisitSummary(startDay, endDay string, startIdx, limit int) ([]VisitSummaryItem, int, VisitDailyStats, error) {
	var rows []VisitLog
	err := DB.Select("user_id", "username", "ip", "created_at").
		Where("day >= ? AND day <= ?", startDay, endDay).
		Find(&rows).Error
	if err != nil {
		return nil, 0, VisitDailyStats{}, err
	}

	type key struct {
		userId int
		ip     string
	}
	summary := make(map[key]*VisitSummaryItem)
	for _, row := range rows {
		k := key{userId: row.UserId, ip: row.Ip}
		if row.UserId > 0 {
			k.ip = ""
		}
		item, ok := summary[k]
		if !ok {
			item = &VisitSummaryItem{
				UserId:      row.UserId,
				Username:    row.Username,
				Ip:          row.Ip,
				IsAnonymous: row.UserId <= 0,
			}
			summary[k] = item
		}
		item.VisitCount++
		if item.FirstVisitAt == 0 || row.CreatedAt < item.FirstVisitAt {
			item.FirstVisitAt = row.CreatedAt
		}
		if row.CreatedAt > item.LastVisitAt {
			item.LastVisitAt = row.CreatedAt
		}
	}

	items := make([]VisitSummaryItem, 0, len(summary))
	for _, item := range summary {
		items = append(items, *item)
	}
	// 最新访问时间倒序，相同则先访问的靠前
	for i := 0; i < len(items); i++ {
		for j := i + 1; j < len(items); j++ {
			a, b := items[i], items[j]
			if b.LastVisitAt > a.LastVisitAt || (b.LastVisitAt == a.LastVisitAt && b.FirstVisitAt < a.FirstVisitAt) {
				items[i], items[j] = b, a
			}
		}
	}

	rangeStart, _ := VisitDayRange(startDay)
	_, rangeEnd := VisitDayRange(endDay)
	userIds := make([]int, 0)
	for _, item := range items {
		if item.UserId > 0 {
			userIds = append(userIds, item.UserId)
		}
	}
	usersById := make(map[int]User)
	if len(userIds) > 0 {
		var users []User
		if err := DB.Select("id", "username", "created_at").Where("id IN ?", userIds).Find(&users).Error; err != nil {
			return nil, 0, VisitDailyStats{}, err
		}
		for _, u := range users {
			usersById[u.Id] = u
		}
	}

	stats := VisitDailyStats{}
	for i := range items {
		item := &items[i]
		if u, ok := usersById[item.UserId]; ok {
			item.UserCreatedAt = u.CreatedAt
			item.Username = u.Username
			item.IsNewUser = u.CreatedAt >= rangeStart && u.CreatedAt < rangeEnd
		}
		switch {
		case item.IsAnonymous:
			stats.Anonymous++
		case item.IsNewUser:
			stats.NewUsers++
			fallthrough
		default:
			stats.LoggedIn++
		}
	}
	stats.TotalVisitors = len(items)

	total := len(items)
	if startIdx > total {
		startIdx = total
	}
	end := startIdx + limit
	if end > total {
		end = total
	}
	return items[startIdx:end], total, stats, nil
}

// GetDailyVisitDetail 查询某位访客（登录用户或匿名 IP）在日期范围内的导航明细。
func GetDailyVisitDetail(startDay, endDay string, userId int, ip string, startIdx, limit int) ([]VisitLog, int64, error) {
	query := DB.Model(&VisitLog{}).Where("day >= ? AND day <= ?", startDay, endDay)
	if userId > 0 {
		query = query.Where("user_id = ?", userId)
	} else {
		query = query.Where("user_id = 0 AND ip = ?", ip)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []VisitLog
	err := query.Order("created_at DESC").Limit(limit).Offset(startIdx).Find(&rows).Error
	return rows, total, err
}

// VisitDayRange 返回某天在东八区的起止时间戳（左闭右开）。
func VisitDayRange(day string) (int64, int64) {
	t, err := time.ParseInLocation(VisitDayFormat, day, VisitDayLocation)
	if err != nil {
		return 0, 0
	}
	return t.Unix(), t.AddDate(0, 0, 1).Unix()
}
