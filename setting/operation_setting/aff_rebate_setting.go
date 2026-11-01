package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// AffRebateSetting 邀请充值返利配置
// 返利按好友到账 quota 的百分比计算，计入邀请人的待领奖励（aff_quota）。
// FirstPercent 为首笔充值比例，Percent 为后续每笔比例；
// FirstDays 限制首充窗口（自注册起 N 天内才算首笔，0 表示不限制）。
type AffRebateSetting struct {
	FirstPercent float64 `json:"first_percent"` // 首笔充值返利百分比，0 表示关闭
	Percent      float64 `json:"percent"`       // 后续每笔充值返利百分比，0 表示关闭
	FirstDays    int     `json:"first_days"`    // 首笔充值限时（天），0 表示不限制
}

// 默认关闭，需要在管理后台「计费与支付 → 邀请奖励」中配置
var affRebateSetting = AffRebateSetting{
	FirstPercent: 0,
	Percent:      0,
	FirstDays:    0,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("aff_rebate_setting", &affRebateSetting)
}

// GetAffRebateSetting 获取邀请充值返利配置
func GetAffRebateSetting() *AffRebateSetting {
	return &affRebateSetting
}
