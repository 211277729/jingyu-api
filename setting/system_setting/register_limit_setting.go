package system_setting

import "github.com/QuantumNous/new-api/setting/config"

// RegisterLimitSetting 注册接口专用频控。
// 双桶：按 IP 一档 + 全站总量一档，全部后台可调，
// 中间件每次请求读取，改动即时生效、无需重启。
type RegisterLimitSetting struct {
	Enabled               bool `json:"enabled"`
	IPNum                 int  `json:"ip_num"`                  // 单 IP 允许次数
	IPDurationSeconds     int  `json:"ip_duration_seconds"`     // 单 IP 窗口时长（秒）
	GlobalNum             int  `json:"global_num"`              // 全站允许次数
	GlobalDurationSeconds int  `json:"global_duration_seconds"` // 全站窗口时长（秒）
}

// 默认配置
var registerLimitSetting = RegisterLimitSetting{
	Enabled:               true,
	IPNum:                 5,
	IPDurationSeconds:     3600,
	GlobalNum:             100,
	GlobalDurationSeconds: 3600,
}

func init() {
	config.GlobalConfig.Register("register_limit_setting", &registerLimitSetting)
}

// GetRegisterLimitSettings 获取注册频控配置
func GetRegisterLimitSettings() *RegisterLimitSetting {
	return &registerLimitSetting
}

// IPWindow 返回按 IP 窗口时长（秒），非法值回落默认。
func (s *RegisterLimitSetting) IPWindow() int64 {
	if s.IPDurationSeconds < 1 {
		return 3600
	}
	return int64(s.IPDurationSeconds)
}

// GlobalWindow 返回全站窗口时长（秒），非法值回落默认。
func (s *RegisterLimitSetting) GlobalWindow() int64 {
	if s.GlobalDurationSeconds < 1 {
		return 3600
	}
	return int64(s.GlobalDurationSeconds)
}
