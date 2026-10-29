package system_setting

import "github.com/QuantumNous/new-api/setting/config"

// SmsSetting 手机号验证码登录配置。
// 密钥字段的命名以 secret 结尾，GetOptions 会按敏感键过滤，
// 管理端"留空表示保持不变"的语义与 SMTPToken 一致。
type SmsSetting struct {
	Enabled  bool   `json:"enabled"`  // 启用手机号验证码登录/注册
	Provider string `json:"provider"` // aliyun | tencent

	AliyunAccessKeyId  string `json:"aliyun_access_key_id"`
	AliyunAccessSecret string `json:"aliyun_access_secret"`
	AliyunSignName     string `json:"aliyun_sign_name"`
	AliyunTemplateCode string `json:"aliyun_template_code"`

	TencentSecretId string `json:"tencent_secret_id"`
	TencentSecret   string `json:"tencent_secret"`
	TencentSdkAppId string `json:"tencent_sdk_app_id"`
	TencentSignName string `json:"tencent_sign_name"`
	TencentTemplateId string `json:"tencent_template_id"`
	TencentRegion   string `json:"tencent_region"`
}

// 默认配置
var smsSetting = SmsSetting{
	Enabled:  false,
	Provider: "aliyun",
	TencentRegion: "ap-guangzhou",
}

func init() {
	config.GlobalConfig.Register("sms_setting", &smsSetting)
}

// GetSmsSettings 获取短信登录配置
func GetSmsSettings() *SmsSetting {
	return &smsSetting
}

// IsPhoneLoginEnabled 是否启用手机号验证码登录/注册
func IsPhoneLoginEnabled() bool {
	return smsSetting.Enabled
}
