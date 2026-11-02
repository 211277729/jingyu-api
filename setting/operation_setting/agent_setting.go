package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// AgentSetting 代理分销配置
// 佣金按客户到账 quota 的百分比计算，计入代理的佣金余额（agent_quota），可申请提现。
// FirstPercent 为客户首笔充值比例，Percent 为后续每笔比例，SecondPercent 为
// 二级佣金比例（代理的邀请人若也是已通过代理，按该比例再得一笔）。
// FirstDays 限制首充窗口（自客户注册起 N 天内才算首笔，0 表示不限制）。
// MinWithdrawQuota 为代理申请提现的最低额度（quota），0 表示不限制。
type AgentSetting struct {
	Enabled          bool    `json:"enabled"`           // 代理分销总开关
	FirstPercent     float64 `json:"first_percent"`     // 客户首笔充值佣金百分比，0 表示关闭
	Percent          float64 `json:"percent"`           // 后续每笔充值佣金百分比，0 表示关闭
	SecondPercent    float64 `json:"second_percent"`    // 二级佣金百分比，0 表示关闭
	FirstDays        int     `json:"first_days"`        // 首笔充值限时（天），0 表示不限制
	MinWithdrawQuota int     `json:"min_withdraw_quota"` // 最低提现额度（quota），0 表示不限制
}

// 默认关闭，需要在管理后台「计费与支付 → 代理分销」中配置
var agentSetting = AgentSetting{
	Enabled:          false,
	FirstPercent:     0,
	Percent:          0,
	SecondPercent:    0,
	FirstDays:        0,
	MinWithdrawQuota: 0,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("agent_setting", &agentSetting)
}

// GetAgentSetting 获取代理分销配置
func GetAgentSetting() *AgentSetting {
	return &agentSetting
}
