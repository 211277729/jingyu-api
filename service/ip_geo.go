package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ip_geo_setting"
)

const (
	ipGeoLookupBodyMax     = 64 * 1024 // 响应体上限，防大响应拖垮内存
	ipGeoPrefetchWorkers   = 2         // 预取有界并发
	ipGeoPrefetchQueueSize = 256       // 预取队列深度，满了直接丢弃（下次打点再试）
	ipGeoLookupTimeoutMax  = 15 * time.Second
)

var (
	ipGeoPrefetchCh   chan string
	ipGeoPrefetchOnce sync.Once
)

func init() {
	// 落库后的陌生 IP 交给本包预取（model 层不 import service，用钩子解耦）。
	model.SetVisitIpGeoPrefetchHook(PrefetchIpGeo)
}

// LookupIpGeo 按配置序查询归属地，第一个成功的 provider 即返回；全失败返回错误。
// 缓存与 singleflight 在 model.LookupIpGeoWithCache 里。
func LookupIpGeo(ip string) (*model.IpGeoInfo, error) {
	setting := ip_geo_setting.GetIpGeoSetting()
	if !setting.Enabled {
		return nil, errors.New("ip geo lookup disabled")
	}
	providers := setting.EnabledProviders()
	if len(providers) == 0 {
		return nil, errors.New("no ip geo provider enabled")
	}

	timeout := time.Duration(setting.EffectiveTimeout()) * time.Second
	if timeout > ipGeoLookupTimeoutMax {
		timeout = ipGeoLookupTimeoutMax
	}
	transport := &http.Transport{
		MaxIdleConns:          4,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   5 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		ResponseHeaderTimeout: timeout,
		DialContext:           (&net.Dialer{Timeout: timeout}).DialContext,
	}
	if common.TLSInsecureSkipVerify {
		transport.TLSClientConfig = common.InsecureTLSConfig.Clone()
	}
	client := &http.Client{Transport: transport}

	var lastErr error
	for _, provider := range providers {
		ctx, cancel := context.WithTimeout(context.Background(), timeout)
		info, err := lookupProvider(ctx, client, provider, ip)
		cancel()
		if err == nil {
			return info, nil
		}
		lastErr = fmt.Errorf("%s: %w", provider.Name, err)
	}
	return nil, lastErr
}

// lookupProvider 调单个 provider 并按其 Type 解析。失败由 Lookup 决定是否续试下一个。
func lookupProvider(ctx context.Context, client *http.Client, provider ip_geo_setting.IpGeoProvider, ip string) (*model.IpGeoInfo, error) {
	fullURL := strings.ReplaceAll(provider.URLTemplate, "{ip}", url.QueryEscape(ip))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fullURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; new-api-ip-geo/1.0)")
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s returned %s", provider.Name, resp.Status)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, ipGeoLookupBodyMax))
	if err != nil {
		return nil, err
	}

	switch provider.Type {
	case ip_geo_setting.ProviderTypeIpApi:
		return parseIpApi(ip, provider.Name, body)
	case ip_geo_setting.ProviderTypeIpSb:
		return parseIpSb(ip, provider.Name, body)
	case ip_geo_setting.ProviderTypeBaidu:
		return parseBaidu(ip, provider.Name, body)
	default:
		return nil, fmt.Errorf("unknown provider type %q", provider.Type)
	}
}

type ipApiResponse struct {
	Status     string `json:"status"`
	Message    string `json:"message"`
	Country    string `json:"country"`
	RegionName string `json:"regionName"`
	City       string `json:"city"`
	Isp        string `json:"isp"`
}

func parseIpApi(ip, source string, body []byte) (*model.IpGeoInfo, error) {
	var parsed ipApiResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	if parsed.Status != "success" {
		if parsed.Message != "" {
			return nil, errors.New(parsed.Message)
		}
		return nil, errors.New("ip-api lookup failed")
	}
	return &model.IpGeoInfo{
		Ip: ip, Country: parsed.Country, Region: parsed.RegionName,
		City: parsed.City, Isp: parsed.Isp, Source: source,
		UpdatedAt: time.Now().Unix(),
	}, nil
}

type ipSbResponse struct {
	Country      string `json:"country"`
	Region       string `json:"region"`
	City         string `json:"city"`
	Organization string `json:"organization"`
	Isp          string `json:"isp"`
}

func parseIpSb(ip, source string, body []byte) (*model.IpGeoInfo, error) {
	var parsed ipSbResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	if parsed.Country == "" && parsed.City == "" {
		return nil, errors.New("ip.sb response missing location fields")
	}
	isp := parsed.Isp
	if isp == "" {
		isp = parsed.Organization
	}
	return &model.IpGeoInfo{
		Ip: ip, Country: parsed.Country, Region: parsed.Region,
		City: parsed.City, Isp: isp, Source: source,
		UpdatedAt: time.Now().Unix(),
	}, nil
}

type baiduResponse struct {
	Status string `json:"status"`
	Data   []struct {
		Location string `json:"location"`
	} `json:"data"`
}

func parseBaidu(ip, source string, body []byte) (*model.IpGeoInfo, error) {
	var parsed baiduResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	if parsed.Status != "0" || len(parsed.Data) == 0 {
		return nil, errors.New("baidu opendata lookup failed")
	}
	// location 形如「浙江省杭州市 阿里云」；海外 IP 时是「美国」这类无省级结构的短词。
	location := strings.TrimSpace(parsed.Data[0].Location)
	if location == "" {
		return nil, errors.New("baidu opendata empty location")
	}
	if !hasChineseProvinceSuffix(location) {
		// 海外：无省/自治区/市级结构，整串当国家。
		return &model.IpGeoInfo{
			Ip: ip, Country: location, Source: source,
			UpdatedAt: time.Now().Unix(),
		}, nil
	}
	region, city, isp := splitBaiduLocation(location)
	return &model.IpGeoInfo{
		Ip: ip, Region: region, City: city, Isp: isp, Source: source,
		UpdatedAt: time.Now().Unix(),
	}, nil
}

// hasChineseProvinceSuffix 是否带省级结构（xx省/自治区/市），用于区分国内外。
func hasChineseProvinceSuffix(location string) bool {
	for _, suffix := range []string{"自治区", "省", "市"} {
		if strings.Contains(location, suffix) {
			return true
		}
	}
	return false
}

// splitBaiduLocation 拆「浙江省杭州市 阿里云」类字符串：省（xx省/自治区/直辖市）+ 市 + 运营商。
func splitBaiduLocation(location string) (region, city, isp string) {
	locPart, ispPart, found := strings.Cut(location, " ")
	if found {
		isp = strings.TrimSpace(ispPart)
	}
	locPart = strings.TrimSpace(locPart)
	// 省级后缀首次出现处切一刀；直辖市（「北京市」）时 city 留空则补 region 同值。
	for _, suffix := range []string{"自治区", "省", "市"} {
		if idx := strings.Index(locPart, suffix); idx >= 0 {
			end := idx + len(suffix)
			region = locPart[:end]
			city = strings.TrimSpace(locPart[end:])
			if city == "" {
				city = region
			}
			return
		}
	}
	// 无法识别省级结构：整串当 city。
	return "", locPart, isp
}

// PrefetchIpGeo 把陌生 IP 丢进预取队列，fire-and-forget，不打打点链路。
func PrefetchIpGeo(ips []string) {
	if !ip_geo_setting.GetIpGeoSetting().Enabled {
		return
	}
	initIpGeoPrefetch()
	for _, ip := range ips {
		select {
		case ipGeoPrefetchCh <- ip:
		default:
			// 队列满直接丢弃：下次打点会再进队列，不值得为它阻塞。
		}
	}
}

func initIpGeoPrefetch() {
	ipGeoPrefetchOnce.Do(func() {
		ipGeoPrefetchCh = make(chan string, ipGeoPrefetchQueueSize)
		for range ipGeoPrefetchWorkers {
			go ipGeoPrefetchWorker()
		}
	})
}

func ipGeoPrefetchWorker() {
	// 库内超过 30 天未刷新的记录顺带更新（每 worker 一小时扫一次，分页取百条）。
	go func() {
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			refreshStaleIpGeo()
		}
	}()
	for ip := range ipGeoPrefetchCh {
		_, _ = model.LookupIpGeoWithCache(ip, LookupIpGeo)
	}
}

// refreshStaleIpGeo 把表内过期记录重新预取一遍（每轮最多 100 条，靠周期任务慢慢追平）。
func refreshStaleIpGeo() {
	if !ip_geo_setting.GetIpGeoSetting().Enabled {
		return
	}
	before := time.Now().Add(-model.IpGeoRefreshInterval).Unix()
	ips, err := model.GetStaleIpGeoIps(before, 100)
	if err != nil || len(ips) == 0 {
		return
	}
	for _, ip := range ips {
		if _, err := model.LookupIpGeoWithCache(ip, LookupIpGeo); err != nil {
			// 单个失败不影响其余（失败哨兵会让下轮自动跳过）。
			continue
		}
	}
}
