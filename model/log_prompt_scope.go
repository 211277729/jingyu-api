package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
)

// ErrPromptScopeUnsupported reports that the configured log database cannot serve
// the prompt-scoped aggregate. Callers fall back to the unscoped metrics.
var ErrPromptScopeUnsupported = errors.New("prompt scoped stats are not supported for this log database")

// PromptScopedDimension selects the key the published scope is grouped by.
type PromptScopedDimension string

const (
	PromptScopedByModel PromptScopedDimension = "model"
	PromptScopedByGroup PromptScopedDimension = "group"
	PromptScopedByHour  PromptScopedDimension = "hour"
)

// PromptScopedStat is one aggregated row of consume logs whose input stays under
// the configured token ceiling. Time values are milliseconds; Key holds the model
// or group name and BucketTs the hour start of the "hour" dimension.
type PromptScopedStat struct {
	Key              string `gorm:"column:stat_key"`
	BucketTs         int64  `gorm:"column:bucket_ts"`
	RequestCount     int64  `gorm:"column:request_count"`
	TotalUseTimeMs   int64  `gorm:"column:total_use_time_ms"`
	CompletionTokens int64  `gorm:"column:completion_tokens"`
	TtftSumMs        int64  `gorm:"column:ttft_sum_ms"`
	TtftCount        int64  `gorm:"column:ttft_count"`
}

// promptScopedGroupExpr returns the grouped expression for one dimension. The hour
// bucket subtracts its own remainder so the expression stays integer arithmetic on
// every supported database.
func promptScopedGroupExpr(dimension PromptScopedDimension) (string, error) {
	switch dimension {
	case PromptScopedByModel:
		return "model_name", nil
	case PromptScopedByGroup:
		return logGroupCol, nil
	case PromptScopedByHour:
		return "(created_at - (created_at % 3600))", nil
	default:
		return "", errors.New("unknown prompt scoped dimension")
	}
}

// promptScopedTtftExpr extracts the logged first-token latency. The value lives in
// the JSON `other` column, so each supported log database needs its own reader;
// rows without a parsable payload yield -1 and are excluded by the CASE guards.
func promptScopedTtftExpr() (string, error) {
	const guard = "CASE WHEN other LIKE '{%' THEN "
	switch common.LogDatabaseType() {
	case common.DatabaseTypePostgreSQL:
		return guard + "COALESCE((other::json ->> 'frt')::numeric, -1) ELSE -1 END", nil
	case common.DatabaseTypeMySQL:
		return guard + "COALESCE(CAST(JSON_EXTRACT(other, '$.frt') AS DECIMAL(20,3)), -1) ELSE -1 END", nil
	case common.DatabaseTypeSQLite:
		return guard + "COALESCE(json_extract(other, '$.frt'), -1) ELSE -1 END", nil
	default:
		return "", ErrPromptScopeUnsupported
	}
}

// SumPromptScopedStats aggregates consume logs for requests whose input stays at
// or under promptTokenLimit. Selecting a scope from existing logs keeps the
// published window complete from the first deploy, unlike a new write path.
// modelName narrows the group and hour dimensions to one model.
func SumPromptScopedStats(sinceTs int64, promptTokenLimit int, dimension PromptScopedDimension, modelName string) ([]PromptScopedStat, error) {
	if promptTokenLimit <= 0 {
		return nil, nil
	}
	groupExpr, err := promptScopedGroupExpr(dimension)
	if err != nil {
		return nil, err
	}
	ttftExpr, err := promptScopedTtftExpr()
	if err != nil {
		return nil, err
	}

	keySelect := groupExpr + " AS stat_key, 0 AS bucket_ts"
	if dimension == PromptScopedByHour {
		keySelect = "'' AS stat_key, " + groupExpr + " AS bucket_ts"
	}

	stats := make([]PromptScopedStat, 0)
	query := LOG_DB.Table("logs").
		Select(keySelect+
			", COUNT(*) AS request_count"+
			", COALESCE(SUM(use_time), 0) * 1000 AS total_use_time_ms"+
			", COALESCE(SUM(completion_tokens), 0) AS completion_tokens"+
			", COALESCE(SUM(CASE WHEN "+ttftExpr+" > 0 THEN "+ttftExpr+" ELSE 0 END), 0) AS ttft_sum_ms"+
			", COALESCE(SUM(CASE WHEN "+ttftExpr+" > 0 THEN 1 ELSE 0 END), 0) AS ttft_count").
		Where("type = ?", LogTypeConsume).
		Where("created_at >= ?", sinceTs).
		Where("prompt_tokens <= ?", promptTokenLimit).
		Group("stat_key, bucket_ts")
	if modelName != "" {
		query = query.Where("model_name = ?", modelName)
	}
	if err := query.Scan(&stats).Error; err != nil {
		return nil, err
	}
	return stats, nil
}
