package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

// GetAgentProfile 获取当前用户的代理档案与佣金余额。
// 无档案时返回 status=none（用户尚未申请），前端据此展示招代理页。
func GetAgentProfile(c *gin.Context) {
	userId := c.GetInt("id")
	setting := operation_setting.GetAgentSetting()

	data := gin.H{
		"enabled":             setting.Enabled,
		"first_percent":       setting.FirstPercent,
		"percent":             setting.Percent,
		"second_percent":      setting.SecondPercent,
		"min_withdraw_quota":  setting.MinWithdrawQuota,
	}
	user, err := model.GetUserById(userId, true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	data["agent_quota"] = user.AgentQuota
	data["agent_history_quota"] = user.AgentHistoryQuota

	profile, err := model.GetUserAgentProfile(userId)
	if err != nil {
		// 无档案：正常场景，返回 status=none
		data["status"] = "none"
		c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
		return
	}
	data["status"] = profile.Status
	data["profile"] = profile
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

// ApplyAgent 用户申请成为代理（被拒/被禁用后可重新申请）
func ApplyAgent(c *gin.Context) {
	setting := operation_setting.GetAgentSetting()
	if !setting.Enabled {
		common.ApiErrorT(c, "Agent distribution feature is not enabled")
		return
	}
	userId := c.GetInt("id")

	var req struct {
		Contact string `json:"contact"`
		Remark  string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Contact == "" {
		common.ApiErrorT(c, "Contact information is required")
		return
	}
	if err := model.ApplyAgentProfile(userId, req.Contact, req.Remark); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccessT(c, "Application submitted, please wait for review", nil)
}

// GetUserAgentCommissions 代理查询自己的佣金明细（分页）
func GetUserAgentCommissions(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetUserAgentCommissions(userId, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

// GetAgentCustomers 代理查询名下客户（分页）
func GetAgentCustomers(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetAgentCustomers(userId, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

// RequestAgentWithdraw 代理申请提现：申请时即冻结额度，管理员拒绝会退还
func RequestAgentWithdraw(c *gin.Context) {
	setting := operation_setting.GetAgentSetting()
	if !setting.Enabled {
		common.ApiErrorT(c, "Agent distribution feature is not enabled")
		return
	}
	userId := c.GetInt("id")

	// 仅已通过的代理可提现
	profile, err := model.GetUserAgentProfile(userId)
	if err != nil || profile.Status != model.AgentStatusApproved {
		common.ApiErrorT(c, "Only approved agents can request withdrawals")
		return
	}

	var req struct {
		Amount int `json:"amount"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.Amount <= 0 {
		common.ApiErrorT(c, "Invalid withdrawal amount")
		return
	}
	if setting.MinWithdrawQuota > 0 && req.Amount < setting.MinWithdrawQuota {
		common.ApiErrorT(c, "Withdrawal amount is below the minimum of {{quota}}", map[string]any{"quota": setting.MinWithdrawQuota})
		return
	}

	withdrawal, err := model.CreateAgentWithdrawal(userId, req.Amount)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccessT(c, "Withdrawal request submitted", withdrawal)
}

// GetUserAgentWithdrawals 代理查询自己的提现记录（分页）
func GetUserAgentWithdrawals(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetUserAgentWithdrawals(userId, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}
