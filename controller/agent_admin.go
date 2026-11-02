package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// GetAllAgentProfiles 管理端分页查询代理档案（可按状态与用户名过滤）
func GetAllAgentProfiles(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetAgentProfiles(pageInfo, c.Query("status"), c.Query("keyword"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

// ReviewAgentProfile 管理员审核代理申请 / 调整在册代理：
// status 取 approved/rejected/disabled；通过时可设置等级与费率覆盖（0 表示沿用全局）。
func ReviewAgentProfile(c *gin.Context) {
	adminId := c.GetInt("id")
	var req struct {
		Id           int     `json:"id"`
		Status       string  `json:"status"`
		Tier         int     `json:"tier"`
		FirstPercent float64 `json:"first_percent"`
		Percent      float64 `json:"percent"`
		Remark       string  `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	switch req.Status {
	case model.AgentStatusApproved, model.AgentStatusRejected, model.AgentStatusDisabled:
	default:
		common.ApiErrorT(c, "Invalid agent status")
		return
	}
	if err := model.ReviewAgentProfile(adminId, req.Id, req.Status, req.Tier, req.FirstPercent, req.Percent, req.Remark); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "agent.profile.review", map[string]any{
		"profile_id":     req.Id,
		"status":         req.Status,
		"tier":           req.Tier,
		"first_percent":  req.FirstPercent,
		"percent":        req.Percent,
	})
	common.ApiSuccess(c, nil)
}

// DeleteAgentProfile 管理员删除代理档案：删除后该用户可重新申请（区别于禁用）。
// 佣金余额保留；存在待处理提现时拒绝。
func DeleteAgentProfile(c *gin.Context) {
	var req struct {
		Id int `json:"id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Id <= 0 {
		common.ApiErrorT(c, "Invalid parameter")
		return
	}
	userId, err := model.DeleteAgentProfile(req.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "agent.profile.delete", map[string]any{
		"profile_id": req.Id,
		"user_id":    userId,
	})
	common.ApiSuccess(c, nil)
}

// AdjustAgentQuota 管理员手动调整代理佣金额度（quota 可正可负，余额不能减为负）
func AdjustAgentQuota(c *gin.Context) {
	adminId := c.GetInt("id")
	var req struct {
		UserId int    `json:"user_id"`
		Quota  int    `json:"quota"`
		Remark string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.UserId <= 0 || req.Quota == 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if err := model.AdjustAgentQuota(adminId, req.UserId, req.Quota, req.Remark); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "agent.quota.adjust", map[string]any{
		"target_user_id": req.UserId,
		"quota":          req.Quota,
		"remark":         req.Remark,
	})
	common.ApiSuccess(c, nil)
}

// GetAllAgentWithdrawals 管理端分页查询提现记录（可按状态过滤）
func GetAllAgentWithdrawals(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	items, total, err := model.GetAllAgentWithdrawals(pageInfo, c.Query("status"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

// ReviewAgentWithdrawal 管理员审核提现：
// approve = 通过（额度申请时已冻结，等待线下发红包）；pay = 标记已发放红包；reject = 拒绝并退还冻结额度。
func ReviewAgentWithdrawal(c *gin.Context) {
	adminId := c.GetInt("id")
	var req struct {
		Id     int    `json:"id"`
		Action string `json:"action"` // approve / pay / reject
		Remark string `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.ReviewAgentWithdrawal(adminId, req.Id, req.Action, req.Remark); err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "agent.withdrawal.review", map[string]any{
		"withdrawal_id": req.Id,
		"action":        req.Action,
		"remark":        req.Remark,
	})
	common.ApiSuccess(c, nil)
}

// GetAllAgentCommissions 管理端分页查询佣金明细（可按代理过滤）
func GetAllAgentCommissions(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	agentUserId := c.Query("agent_user_id")
	var agentId int
	if agentUserId != "" {
		agentId = common.String2Int(agentUserId)
	}
	items, total, err := model.GetAllAgentCommissions(agentId, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

// BindAgentCustomer 管理员把客户归属绑定/换绑到指定代理（改 users.inviter_id）
func BindAgentCustomer(c *gin.Context) {
	var req struct {
		UserId     int `json:"user_id"`
		AgentUserId int `json:"agent_user_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if req.UserId <= 0 || req.AgentUserId <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if req.UserId == req.AgentUserId {
		common.ApiErrorT(c, "A user cannot be bound to themselves")
		return
	}
	// 目标必须是已通过的代理
	profile, err := model.GetUserAgentProfile(req.AgentUserId)
	if err != nil || profile.Status != model.AgentStatusApproved {
		common.ApiErrorT(c, "Target user is not an approved agent")
		return
	}
	if err := model.DB.Model(&model.User{}).Where("id = ?", req.UserId).
		Update("inviter_id", req.AgentUserId).Error; err != nil {
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "agent.customer.bind", map[string]any{
		"target_user_id": req.UserId,
		"agent_user_id":  req.AgentUserId,
	})
	common.ApiSuccess(c, nil)
}
