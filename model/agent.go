package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

// 代理档案状态
const (
	AgentStatusPending  = "pending"
	AgentStatusApproved = "approved"
	AgentStatusRejected = "rejected"
	AgentStatusDisabled = "disabled"
)

// 代理提现状态：申请时即锁定额度（扣 agent_quota），拒绝时退还
const (
	AgentWithdrawalStatusPending  = "pending"  // 待审核（额度已冻结）
	AgentWithdrawalStatusApproved = "approved" // 审核通过，待线下发放红包
	AgentWithdrawalStatusPaid     = "paid"     // 已发放红包
	AgentWithdrawalStatusRejected = "rejected" // 已拒绝（额度已退还）
)

// 佣金层级：1 = 客户直接邀请人，2 = 一级代理的邀请人（也须是已通过代理）
const (
	AgentCommissionLevel1 = 1
	AgentCommissionLevel2 = 2
)

// 这些错误会经 ApiError 直达前端控制台，用 *Message 携带 message_key，
// 前端按当前语言翻译；Error() 渲染英文原文，供 API 调用方与日志兜底。
var (
	ErrAgentProfileExists          = common.NewMessage("Agent application already exists")
	ErrAgentQuotaInsufficient      = common.NewMessage("Insufficient agent commission balance")
	ErrAgentWithdrawalStatusInvald = common.NewMessage("Invalid withdrawal status")
	ErrAgentPendingWithdrawal      = common.NewMessage("Agent has pending withdrawals, cannot delete")
)

// AgentProfile 代理档案：一个用户至多一份，申请后由管理员审核
type AgentProfile struct {
	Id           int     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId       int     `json:"user_id" gorm:"uniqueIndex;not null"`
	Status       string  `json:"status" gorm:"type:varchar(16);not null;default:'pending';index"`
	Tier         int     `json:"tier" gorm:"type:int;default:1"` // 1 普通代理 2 高级代理
	Contact      string  `json:"contact" gorm:"type:varchar(128);column:contact"`
	Remark       string  `json:"remark" gorm:"type:varchar(255);column:remark"`
	FirstPercent float64 `json:"first_percent" gorm:"default:0;column:first_percent"` // 覆盖全局首充比例，0 表示用全局
	Percent      float64 `json:"percent" gorm:"default:0;column:percent"`             // 覆盖全局常规比例，0 表示用全局
	AppliedAt    int64   `json:"applied_at" gorm:"bigint;column:applied_at"`
	ReviewedAt   int64   `json:"reviewed_at" gorm:"bigint;column:reviewed_at"`
	ReviewedBy   int     `json:"reviewed_by" gorm:"type:int;default:0;column:reviewed_by"`
}

func (AgentProfile) TableName() string {
	return "agent_profiles"
}

// AgentCommission 代理佣金明细：所有层级佣金各记一行，对账以此为准
type AgentCommission struct {
	Id              int     `json:"id" gorm:"primaryKey;autoIncrement"`
	AgentUserId     int     `json:"agent_user_id" gorm:"not null;index:idx_agent_commission_agent_time,priority:1"`
	PayerUserId     int     `json:"payer_user_id" gorm:"not null;index"`
	Level           int     `json:"level" gorm:"type:int;not null;default:1"`
	TopUpId         int     `json:"topup_id" gorm:"type:int;default:0;column:topup_id"`
	RedemptionId    int     `json:"redemption_id" gorm:"type:int;default:0;column:redemption_id"`
	TradeNo         string  `json:"trade_no" gorm:"type:varchar(64);index"`
	CreditedQuota   int     `json:"credited_quota" gorm:"not null"`
	Percent         float64 `json:"percent" gorm:"not null"`
	CommissionQuota int     `json:"commission_quota" gorm:"not null"`
	CreatedAt       int64   `json:"created_at" gorm:"bigint;index:idx_agent_commission_agent_time,priority:2"`
}

func (AgentCommission) TableName() string {
	return "agent_commissions"
}

// AgentWithdrawal 代理提现申请
type AgentWithdrawal struct {
	Id         int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId     int    `json:"user_id" gorm:"not null;index"`
	Amount     int    `json:"amount" gorm:"not null"`
	Status     string `json:"status" gorm:"type:varchar(16);not null;default:'pending';index"`
	Remark     string `json:"remark" gorm:"type:varchar(255);column:remark"`
	AppliedAt  int64  `json:"applied_at" gorm:"bigint;column:applied_at"`
	ReviewedAt int64  `json:"reviewed_at" gorm:"bigint;column:reviewed_at"`
	ReviewedBy int    `json:"reviewed_by" gorm:"type:int;default:0;column:reviewed_by"`
	PaidAt     int64  `json:"paid_at" gorm:"bigint;column:paid_at"`
}

func (AgentWithdrawal) TableName() string {
	return "agent_withdrawals"
}

// 列表视图：附带你好用户名，方便管理端与代理端直接展示
type AgentProfileView struct {
	AgentProfile
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
}

type AgentCommissionView struct {
	AgentCommission
	PayerUsername string `json:"payer_username"`
}

type AgentWithdrawalView struct {
	AgentWithdrawal
	Username string `json:"username"`
}

// RebateSource 描述一笔到账的来源，用于代理佣金明细对账。
type RebateSource struct {
	TopUpId      int
	RedemptionId int
	TradeNo      string
}

// getApprovedAgentProfile 查用户的有效代理档案（仅 approved），无档案返回 gorm.ErrRecordNotFound。
// 结算路径在充值事务内调用。
func getApprovedAgentProfile(tx *gorm.DB, userId int) (*AgentProfile, error) {
	var profile AgentProfile
	err := tx.Where("user_id = ? AND status = ?", userId, AgentStatusApproved).
		First(&profile).Error
	if err != nil {
		return nil, err
	}
	return &profile, nil
}

// GetUserAgentProfile 获取当前用户的代理档案（任意状态）
func GetUserAgentProfile(userId int) (*AgentProfile, error) {
	var profile AgentProfile
	err := DB.Where("user_id = ?", userId).First(&profile).Error
	if err != nil {
		return nil, err
	}
	return &profile, nil
}

// ApplyAgentProfile 用户提交代理申请：首次创建 pending；被拒/被禁用后可重新申请转回 pending
func ApplyAgentProfile(userId int, contact string, remark string) error {
	now := common.GetTimestamp()
	return DB.Transaction(func(tx *gorm.DB) error {
		var profile AgentProfile
		err := tx.Where("user_id = ?", userId).First(&profile).Error
		if err == nil {
			switch profile.Status {
			case AgentStatusPending:
				return ErrAgentProfileExists
			case AgentStatusApproved:
				return ErrAgentProfileExists
			case AgentStatusRejected, AgentStatusDisabled:
				// 重新申请：重置申请信息，回到待审核
				return tx.Model(&profile).Updates(map[string]any{
					"status":     AgentStatusPending,
					"contact":    contact,
					"remark":     remark,
					"applied_at": now,
				}).Error
			}
			return ErrAgentProfileExists
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		return tx.Create(&AgentProfile{
			UserId:    userId,
			Status:    AgentStatusPending,
			Contact:   contact,
			Remark:    remark,
			AppliedAt: now,
		}).Error
	})
}

// ReviewAgentProfile 管理员审核代理申请或调整在册代理：
// 通过/拒绝/禁用三种动作；通过时可设置等级与费率覆盖（0 表示沿用全局）。
func ReviewAgentProfile(adminId int, profileId int, status string, tier int, firstPercent float64, percent float64, remark string) error {
	now := common.GetTimestamp()
	updates := map[string]any{
		"status":       status,
		"reviewed_at":  now,
		"reviewed_by":  adminId,
		"remark":       remark,
	}
	if status == AgentStatusApproved {
		if tier != 1 && tier != 2 {
			tier = 1
		}
		updates["tier"] = tier
		updates["first_percent"] = firstPercent
		updates["percent"] = percent
	}
	result := DB.Model(&AgentProfile{}).Where("id = ?", profileId).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// DeleteAgentProfile 管理员删除代理档案：与禁用不同，删除后该用户可以重新申请。
// 佣金余额（users.agent_quota）保留不动；存在待处理提现时拒绝删除，避免冻结款无处结算。
func DeleteAgentProfile(profileId int) (userId int, err error) {
	err = DB.Transaction(func(tx *gorm.DB) error {
		var profile AgentProfile
		if err := tx.Where("id = ?", profileId).First(&profile).Error; err != nil {
			return err
		}
		var pending int64
		if err := tx.Model(&AgentWithdrawal{}).
			Where("user_id = ? AND status = ?", profile.UserId, AgentWithdrawalStatusPending).
			Count(&pending).Error; err != nil {
			return err
		}
		if pending > 0 {
			return ErrAgentPendingWithdrawal
		}
		if err := tx.Where("id = ?", profileId).Delete(&AgentProfile{}).Error; err != nil {
			return err
		}
		userId = profile.UserId
		return nil
	})
	return userId, err
}

// GetAgentProfiles 管理端分页查询代理档案（可按状态与用户名关键词过滤）
func GetAgentProfiles(pageInfo *common.PageInfo, status string, keyword string) ([]AgentProfileView, int64, error) {
	tx := DB.Table("agent_profiles").
		Joins("LEFT JOIN users ON users.id = agent_profiles.user_id").
		Select("agent_profiles.*, users.username, users.display_name")
	if status != "" {
		tx = tx.Where("agent_profiles.status = ?", status)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		tx = tx.Where("users.username LIKE ?", like)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var profiles []AgentProfileView
	err := tx.Order("agent_profiles.id DESC").
		Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).
		Scan(&profiles).Error
	return profiles, total, err
}

// GetUserAgentCommissions 代理本人分页查询佣金明细
func GetUserAgentCommissions(agentUserId int, pageInfo *common.PageInfo) ([]AgentCommissionView, int64, error) {
	return getAgentCommissions(pageInfo, "agent_commissions.agent_user_id = ?", agentUserId)
}

// GetAllAgentCommissions 管理端分页查询佣金明细（agentUserId 0 表示不过滤）
func GetAllAgentCommissions(agentUserId int, pageInfo *common.PageInfo) ([]AgentCommissionView, int64, error) {
	if agentUserId > 0 {
		return getAgentCommissions(pageInfo, "agent_commissions.agent_user_id = ?", agentUserId)
	}
	return getAgentCommissions(pageInfo, "", nil)
}

func getAgentCommissions(pageInfo *common.PageInfo, cond string, args any) ([]AgentCommissionView, int64, error) {
	tx := DB.Table("agent_commissions").
		Joins("LEFT JOIN users ON users.id = agent_commissions.payer_user_id").
		Select("agent_commissions.*, users.username AS payer_username")
	if cond != "" {
		tx = tx.Where(cond, args)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []AgentCommissionView
	err := tx.Order("agent_commissions.id DESC").
		Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).
		Scan(&items).Error
	return items, total, err
}

// GetAgentCustomers 代理名下客户列表（归属 = users.inviter_id），附带给该客户累计付的佣金
func GetAgentCustomers(agentUserId int, pageInfo *common.PageInfo) ([]map[string]any, int64, error) {
	base := DB.Table("users").
		Joins("LEFT JOIN agent_commissions ON agent_commissions.payer_user_id = users.id "+
			"AND agent_commissions.agent_user_id = ? AND agent_commissions.level = ?", agentUserId, AgentCommissionLevel1).
		Where("users.inviter_id = ?", agentUserId)
	var total int64
	if err := base.Distinct("users.id").Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []map[string]any
	err := base.Select(
		"users.id AS user_id, users.username, users.display_name, users.created_at, "+
			"COALESCE(SUM(agent_commissions.commission_quota), 0) AS total_commission",
	).Group("users.id").Order("users.id DESC").
		Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).
		Scan(&items).Error
	return items, total, err
}

// CreateAgentWithdrawal 代理提交提现申请：事务内原子冻结额度（agent_quota 扣减），
// 额度不足或并发下余额不够时失败。
func CreateAgentWithdrawal(userId int, amount int) (*AgentWithdrawal, error) {
	now := common.GetTimestamp()
	withdrawal := &AgentWithdrawal{
		UserId:    userId,
		Amount:    amount,
		Status:    AgentWithdrawalStatusPending,
		AppliedAt: now,
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&User{}).
			Where("id = ? AND agent_quota >= ?", userId, amount).
			Update("agent_quota", gorm.Expr("agent_quota - ?", amount))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrAgentQuotaInsufficient
		}
		return tx.Create(withdrawal).Error
	})
	if err != nil {
		return nil, err
	}
	return withdrawal, nil
}

// GetUserAgentWithdrawals 代理本人分页查询提现记录
func GetUserAgentWithdrawals(userId int, pageInfo *common.PageInfo) ([]AgentWithdrawal, int64, error) {
	return getAgentWithdrawals(pageInfo, "agent_withdrawals.user_id = ?", userId)
}

// GetAllAgentWithdrawals 管理端分页查询提现记录（可按状态过滤）
func GetAllAgentWithdrawals(pageInfo *common.PageInfo, status string) ([]AgentWithdrawalView, int64, error) {
	tx := DB.Table("agent_withdrawals").
		Joins("LEFT JOIN users ON users.id = agent_withdrawals.user_id").
		Select("agent_withdrawals.*, users.username")
	if status != "" {
		tx = tx.Where("agent_withdrawals.status = ?", status)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []AgentWithdrawalView
	err := tx.Order("agent_withdrawals.id DESC").
		Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).
		Scan(&items).Error
	return items, total, err
}

func getAgentWithdrawals(pageInfo *common.PageInfo, cond string, args any) ([]AgentWithdrawal, int64, error) {
	tx := DB.Model(&AgentWithdrawal{})
	if cond != "" {
		tx = tx.Where(cond, args)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var items []AgentWithdrawal
	err := tx.Order("id DESC").
		Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).
		Find(&items).Error
	return items, total, err
}

// ReviewAgentWithdrawal 管理员审核提现：
//   - approve：pending -> approved（额度已在申请时冻结，只改状态）
//   - pay：approved -> paid（线下红包已发放）
//   - reject：pending/approved -> rejected，退还冻结额度
func ReviewAgentWithdrawal(adminId int, withdrawalId int, action string, remark string) error {
	now := common.GetTimestamp()
	var status string
	switch action {
	case "approve":
		status = AgentWithdrawalStatusApproved
	case "pay":
		status = AgentWithdrawalStatusPaid
	case "reject":
		status = AgentWithdrawalStatusRejected
	default:
		return ErrAgentWithdrawalStatusInvald
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		var withdrawal AgentWithdrawal
		if err := lockForUpdate(tx).Where("id = ?", withdrawalId).First(&withdrawal).Error; err != nil {
			return err
		}

		// 状态机校验
		switch action {
		case "approve":
			if withdrawal.Status != AgentWithdrawalStatusPending {
				return ErrAgentWithdrawalStatusInvald
			}
		case "pay":
			if withdrawal.Status != AgentWithdrawalStatusApproved {
				return ErrAgentWithdrawalStatusInvald
			}
		case "reject":
			if withdrawal.Status != AgentWithdrawalStatusPending &&
				withdrawal.Status != AgentWithdrawalStatusApproved {
				return ErrAgentWithdrawalStatusInvald
			}
		}

		updates := map[string]any{
			"status":      status,
			"remark":      remark,
			"reviewed_at": now,
			"reviewed_by": adminId,
		}
		if action == "pay" {
			updates["paid_at"] = now
		}
		if err := tx.Model(&withdrawal).Updates(updates).Error; err != nil {
			return err
		}

		// 拒绝时退还冻结额度（申请时扣过）
		if action == "reject" {
			result := tx.Model(&User{}).Where("id = ?", withdrawal.UserId).
				Update("agent_quota", gorm.Expr("agent_quota + ?", withdrawal.Amount))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return gorm.ErrRecordNotFound
			}
		}
		return nil
	})
}

// applyAgentCommission 发放代理佣金（在充值事务内调用，失败会回滚整笔充值）：
// 一级 = 客户直接邀请人（须为已通过代理，比例取档案覆盖 ?? 全局配置）；
// 二级 = 一级代理的邀请人（也须为已通过代理，比例用全局 SecondPercent）。
func applyAgentCommission(tx *gorm.DB, payerUserId int, creditedQuota int, isFirst bool, payerCreatedAt int64, profile *AgentProfile, source *RebateSource) error {
	setting := operation_setting.GetAgentSetting()

	// 一级佣金：档案覆盖比例优先，0 表示用全局（含首充窗口内的首充比例）
	percent := profile.Percent
	firstPercent := profile.FirstPercent
	if firstPercent <= 0 {
		firstPercent = setting.FirstPercent
	}
	if isFirst {
		withinWindow := setting.FirstDays <= 0 ||
			common.GetTimestamp()-payerCreatedAt <= int64(setting.FirstDays)*86400
		if withinWindow && firstPercent > 0 {
			percent = firstPercent
		}
	}
	if percent > 0 {
		if err := creditAgentCommission(tx, profile.UserId, payerUserId, AgentCommissionLevel1, creditedQuota, percent, source); err != nil {
			return err
		}
	}

	// 二级佣金：一级代理的邀请人若也是已通过代理
	if setting.SecondPercent > 0 {
		var agent struct {
			InviterId int `gorm:"column:inviter_id"`
		}
		if err := tx.Model(&User{}).Select("inviter_id").
			Where("id = ?", profile.UserId).First(&agent).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		if agent.InviterId == 0 || agent.InviterId == payerUserId {
			return nil
		}
		upline, err := getApprovedAgentProfile(tx, agent.InviterId)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		if err := creditAgentCommission(tx, upline.UserId, payerUserId, AgentCommissionLevel2, creditedQuota, setting.SecondPercent, source); err != nil {
			return err
		}
	}
	return nil
}

// creditAgentCommission 计算一档佣金并原子累加到代理的 agent_quota / agent_history，
// 同时写入佣金明细。比例过低算不出有效额度时不发佣金，不影响充值本身。
func creditAgentCommission(tx *gorm.DB, agentUserId int, payerUserId int, level int, creditedQuota int, percent float64, source *RebateSource) error {
	commission, err := common.WalletQuotaFromDecimalStrict(
		decimal.NewFromInt(int64(creditedQuota)).
			Mul(decimal.NewFromFloat(percent)).
			Div(decimal.NewFromInt(100)).
			Floor(),
	)
	if err != nil || commission <= 0 {
		return nil
	}

	result := tx.Model(&User{}).Where("id = ?", agentUserId).Updates(map[string]any{
		"agent_quota":   gorm.Expr("agent_quota + ?", commission),
		"agent_history": gorm.Expr("agent_history + ?", commission),
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		// 代理账号已不存在（注销等）时跳过佣金，不影响充值
		return nil
	}

	record := &AgentCommission{
		AgentUserId:     agentUserId,
		PayerUserId:     payerUserId,
		Level:           level,
		CreditedQuota:   creditedQuota,
		Percent:         percent,
		CommissionQuota: commission,
		CreatedAt:       common.GetTimestamp(),
	}
	if source != nil {
		record.TopUpId = source.TopUpId
		record.RedemptionId = source.RedemptionId
		record.TradeNo = source.TradeNo
	}
	if err := tx.Create(record).Error; err != nil {
		return err
	}
	RecordLog(agentUserId, LogTypeSystem, common.NewMessage("Agent commission from customer top-up: {{quota}}", map[string]any{"quota": logger.FormatQuota(commission)}))
	return nil
}

// AdjustAgentQuota 管理员手动调整代理佣金额度（delta 可正可负，余额不能减为负）
func AdjustAgentQuota(adminId int, userId int, delta int, remark string) error {
	err := DB.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&User{}).
			Where("id = ? AND agent_quota + ? >= 0", userId, delta).
			Updates(map[string]any{
				"agent_quota": gorm.Expr("agent_quota + ?", delta),
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrAgentQuotaInsufficient
		}
		return nil
	})
	if err != nil {
		return err
	}
	if delta >= 0 {
		RecordLog(userId, LogTypeSystem, common.NewMessage("Agent commission adjusted by administrator: +{{quota}}", map[string]any{"quota": delta, "remark": remark}))
	} else {
		RecordLog(userId, LogTypeSystem, common.NewMessage("Agent commission adjusted by administrator: {{quota}}", map[string]any{"quota": delta, "remark": remark}))
	}
	return nil
}
