package model

import (
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// 超长上下文守卫的命中日志。只记"相关"事件，不记正常放行的普通请求：
// DecisionBlocked = 被拦截（冷启动超限）
// DecisionAllowedActive = 任务进行中超限放行（活跃窗口豁免，仍是带宽开销）
const (
	GuardDecisionBlocked       = 1
	GuardDecisionAllowedActive = 2
)

const (
	guardFlushInterval = 5 * time.Second
	guardFlushBatch    = 200
	guardFlushSubBatch = 100
)

// GuardLog 一次守卫决策记录，用于评估阈值是否合理、找出超长大户。
type GuardLog struct {
	Id              int    `json:"id" gorm:"primaryKey"`
	Day             string `json:"day" gorm:"type:varchar(10);index:idx_guard_day_decision,priority:1"`
	UserId          int    `json:"user_id" gorm:"index"`
	Username        string `json:"username" gorm:"type:varchar(64)"`
	TokenName       string `json:"token_name" gorm:"type:varchar(64)"`
	Model           string `json:"model" gorm:"type:varchar(128)"`
	Endpoint        string `json:"endpoint" gorm:"type:varchar(128)"`
	BodyBytes       int64  `json:"body_bytes" gorm:"bigint"`
	EstimatedTokens int    `json:"estimated_tokens"`
	MaxTokens       int    `json:"max_tokens"`
	Decision        int    `json:"decision" gorm:"index:idx_guard_day_decision,priority:2"`
	CreatedAt       int64  `json:"created_at" gorm:"bigint"`
}

// guardBuffer 与 VisitLog 同款：先落内存攒批，后台 goroutine 周期落库。
var guardBuffer = struct {
	sync.Mutex
	pending []GuardLog
}{}

// RecordGuardLog 埋点入口；写库失败只记日志，不影响请求主链路。
func RecordGuardLog(log GuardLog) {
	log.Day = time.Now().In(VisitDayLocation).Format(VisitDayFormat)
	if log.CreatedAt == 0 {
		log.CreatedAt = time.Now().Unix()
	}

	guardBuffer.Lock()
	guardBuffer.pending = append(guardBuffer.pending, log)
	shouldFlush := len(guardBuffer.pending) >= guardFlushBatch
	guardBuffer.Unlock()

	if shouldFlush {
		FlushGuardLogBuffer()
	}
}

// InitGuardLogRecorder 周期性落库 goroutine（main.go 启动）。
func InitGuardLogRecorder() {
	ticker := time.NewTicker(guardFlushInterval)
	defer ticker.Stop()
	for range ticker.C {
		FlushGuardLogBuffer()
	}
}

// FlushGuardLogBuffer 批量写库；锁外执行，失败不丢服务。
func FlushGuardLogBuffer() {
	guardBuffer.Lock()
	batch := guardBuffer.pending
	guardBuffer.pending = nil
	guardBuffer.Unlock()

	if len(batch) == 0 {
		return
	}
	if err := DB.CreateInBatches(&batch, guardFlushSubBatch).Error; err != nil {
		common.SysError(common.LogText("failed to flush guard logs: %s", err.Error()))
	}
}

// GuardDecisionCount 单个决策维度在查询范围内的次数与占比。
type GuardDecisionCount struct {
	Decision int   `json:"decision"`
	Count    int64 `json:"count"`
}

// GuardStatsResponse 守卫命中总览：今日与近 7 天的两个决策计数 + 大户。
type GuardStatsResponse struct {
	Today      []GuardDecisionCount `json:"today"`
	Last7Days  []GuardDecisionCount `json:"last_7_days"`
	TopUsers   []GuardUserStat      `json:"top_users"`
	MaxTokens  int                  `json:"max_estimated_tokens"`
	MaxBytes   int64                `json:"max_body_bytes"`
	TotalToday int64                `json:"total_today"`
}

// GuardUserStat 近 7 天命中次数最多的大户。
type GuardUserStat struct {
	UserId   int    `json:"user_id"`
	Username string `json:"username"`
	Count    int64  `json:"count"`
}

// GetGuardStats 汇总统计，与明细接口配合评估阈值。
func GetGuardStats() (*GuardStatsResponse, error) {
	resp := &GuardStatsResponse{}
	today := time.Now().In(VisitDayLocation).Format(VisitDayFormat)
	weekAgo := time.Now().In(VisitDayLocation).AddDate(0, 0, -6).Format(VisitDayFormat)

	if err := DB.Model(&GuardLog{}).
		Select("decision, count(*) as count").
		Where("day = ?", today).
		Group("decision").
		Find(&resp.Today).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&GuardLog{}).
		Select("decision, count(*) as count").
		Where("day >= ?", weekAgo).
		Group("decision").
		Find(&resp.Last7Days).Error; err != nil {
		return nil, err
	}
	if err := DB.Model(&GuardLog{}).
		Select("user_id, username, count(*) as count").
		Where("day >= ?", weekAgo).
		Group("user_id, username").
		Order("count DESC").
		Limit(5).
		Find(&resp.TopUsers).Error; err != nil {
		return nil, err
	}
	DB.Model(&GuardLog{}).Select("coalesce(max(estimated_tokens), 0)").
		Where("day >= ?", weekAgo).Scan(&resp.MaxTokens)
	DB.Model(&GuardLog{}).Select("coalesce(max(body_bytes), 0)").
		Where("day >= ?", weekAgo).Scan(&resp.MaxBytes)
	for _, d := range resp.Today {
		resp.TotalToday += d.Count
	}
	return resp, nil
}

// GetGuardLogs 分页明细，可选按决策与用户名过滤。
func GetGuardLogs(decision int, username string, offset, limit int) ([]GuardLog, int64, error) {
	query := DB.Model(&GuardLog{})
	if decision > 0 {
		query = query.Where("decision = ?", decision)
	}
	if username != "" {
		query = query.Where("username = ?", username)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var logs []GuardLog
	if err := query.Order("id DESC").Offset(offset).Limit(limit).Find(&logs).Error; err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}
