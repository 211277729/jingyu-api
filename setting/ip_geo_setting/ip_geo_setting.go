package ip_geo_setting

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/setting/config"
)

// ProviderType 内置解析器类型。管理员新增接口时，URL 换成同格式接口即可复用。
const (
	ProviderTypeIpApi = "ip_api" // http://ip-api.com/json/{ip} 系（status/country/regionName/city/isp）
	ProviderTypeIpSb  = "ip_sb"  // https://api.ip.sb/geoip/{ip} 系（country/city/organization）
	ProviderTypeBaidu = "baidu"  // opendata.baidu.com resource_id=6006（data[0].location 一整串）
)

// ipPlaceholder URL 模板里必须包含的占位符。
const ipPlaceholder = "{ip}"

// ProviderTypes 返回全部内置解析器类型（供校验与前端下拉使用）。
func ProviderTypes() []string {
	return []string{ProviderTypeIpApi, ProviderTypeIpSb, ProviderTypeBaidu}
}

// IpGeoProvider 单个归属地查询接口。
type IpGeoProvider struct {
	Name        string `json:"name"`         // 展示名
	URLTemplate string `json:"url_template"` // 含 {ip} 占位符
	Type        string `json:"type"`         // 内置解析器类型
	Enabled     bool   `json:"enabled"`
}

// IpGeoSetting IP 归属地查询配置。
// DB 键：ip_geo_setting.enabled / ip_geo_setting.providers / ip_geo_setting.timeout_seconds
type IpGeoSetting struct {
	Enabled        bool            `json:"enabled"`
	Providers      []IpGeoProvider `json:"providers"` // 按序尝试，第一个成功即止
	TimeoutSeconds int             `json:"timeout_seconds"`
}

// 默认故障转移链：ip-api（中文、45 req/min 免费）→ ip.sb（海外稳定）→ 百度 opendata（国内兜底）。
var defaultProviders = []IpGeoProvider{
	{
		Name:        "ip-api.com",
		URLTemplate: "http://ip-api.com/json/{ip}?lang=zh-CN&fields=status,message,country,regionName,city,isp",
		Type:        ProviderTypeIpApi,
		Enabled:     true,
	},
	{
		Name:        "ip.sb",
		URLTemplate: "https://api.ip.sb/geoip/{ip}",
		Type:        ProviderTypeIpSb,
		Enabled:     true,
	},
	{
		Name:        "Baidu OpenData",
		URLTemplate: "https://opendata.baidu.com/api.php?query={ip}&co=&resource_id=6006&oe=utf8",
		Type:        ProviderTypeBaidu,
		Enabled:     true,
	},
}

var ipGeoSetting = IpGeoSetting{
	Enabled:        false,
	Providers:      defaultProviders,
	TimeoutSeconds: 5,
}

func init() {
	config.GlobalConfig.Register("ip_geo_setting", &ipGeoSetting)
}

// GetIpGeoSetting 获取配置。
func GetIpGeoSetting() *IpGeoSetting {
	return &ipGeoSetting
}

// EffectiveTimeout 查询单个接口的超时秒数（防御未初始化的零值）。
func (s *IpGeoSetting) EffectiveTimeout() int {
	if s.TimeoutSeconds <= 0 {
		return 5
	}
	if s.TimeoutSeconds > 30 {
		return 30
	}
	return s.TimeoutSeconds
}

// EnabledProviders 过滤出启用的 provider，保持配置顺序。
func (s *IpGeoSetting) EnabledProviders() []IpGeoProvider {
	providers := make([]IpGeoProvider, 0, len(s.Providers))
	for _, p := range s.Providers {
		if p.Enabled && p.URLTemplate != "" && p.Type != "" {
			providers = append(providers, p)
		}
	}
	return providers
}

// ValidateProvidersJSON 校验 providers JSON 数组：
// url_template 必须含 {ip} 占位符，type 必须是内置解析器之一。
func ValidateProvidersJSON(value string) error {
	var providers []IpGeoProvider
	if err := json.Unmarshal([]byte(value), &providers); err != nil {
		return fmt.Errorf("invalid providers JSON: %w", err)
	}
	for i, p := range providers {
		if !strings.Contains(p.URLTemplate, ipPlaceholder) {
			return fmt.Errorf("provider #%d (%s): url_template must contain %s", i+1, p.Name, ipPlaceholder)
		}
		if !isValidProviderType(p.Type) {
			return fmt.Errorf("provider #%d (%s): unknown type %q, expected one of %s", i+1, p.Name, p.Type, strings.Join(ProviderTypes(), "/"))
		}
	}
	return nil
}

func isValidProviderType(t string) bool {
	for _, valid := range ProviderTypes() {
		if t == valid {
			return true
		}
	}
	return false
}
