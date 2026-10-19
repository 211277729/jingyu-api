package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// setupPromptScopeLogDB runs the aggregate against a real SQLite engine, which
// exercises the JSON payload reader and the hour bucket expression.
func setupPromptScopeLogDB(t *testing.T) *gorm.DB {
	t.Helper()
	previousDB, previousType := LOG_DB, common.LogDatabaseType()
	db, err := gorm.Open(sqlite.Open("file:prompt_scope?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	LOG_DB = db
	common.SetLogDatabaseType(common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		LOG_DB = previousDB
		common.SetLogDatabaseType(previousType)
	})
	require.NoError(t, db.AutoMigrate(&Log{}))
	return db
}

func TestSumPromptScopedStatsFiltersByInputSize(t *testing.T) {
	db := setupPromptScopeLogDB(t)
	hour := int64(1_800_000_000)
	rows := []Log{
		// 3 short requests: 2s + 4s + 6s total, first tokens 0.5s + 1s + 1.5s.
		{Type: LogTypeConsume, CreatedAt: hour + 60, ModelName: "short-model", PromptTokens: 800, CompletionTokens: 100, UseTime: 2, Other: `{"frt":500}`},
		{Type: LogTypeConsume, CreatedAt: hour + 120, ModelName: "short-model", PromptTokens: 4000, CompletionTokens: 200, UseTime: 4, Other: `{"frt":1000}`},
		{Type: LogTypeConsume, CreatedAt: hour + 180, ModelName: "short-model", PromptTokens: 8000, CompletionTokens: 300, UseTime: 6, Other: `{"frt":1500}`},
		// Outside the ceiling, a top-up, an error log and a payload without frt.
		{Type: LogTypeConsume, CreatedAt: hour + 240, ModelName: "short-model", PromptTokens: 8001, CompletionTokens: 900, UseTime: 30, Other: `{"frt":20000}`},
		{Type: LogTypeConsume, CreatedAt: hour + 300, ModelName: "long-model", PromptTokens: 200000, CompletionTokens: 500, UseTime: 40, Other: `{"frt":11000}`},
		{Type: LogTypeTopup, CreatedAt: hour + 360, ModelName: "short-model", PromptTokens: 10, UseTime: 1},
		{Type: LogTypeError, CreatedAt: hour + 420, ModelName: "short-model", PromptTokens: 10, UseTime: 0},
		{Type: LogTypeConsume, CreatedAt: hour + 480, ModelName: "short-model", PromptTokens: 100, CompletionTokens: 50, UseTime: 3, Other: `{"frt":-1000}`},
	}
	require.NoError(t, db.Create(&rows).Error)

	stats, err := SumPromptScopedStats(hour, 8000, PromptScopedByModel, "")
	require.NoError(t, err)
	require.Len(t, stats, 1, "a model with no in-scope request has no row, so it keeps the full number")

	short := stats[0]
	assert.Equal(t, "short-model", short.Key)
	assert.EqualValues(t, 4, short.RequestCount, "three in-scope requests plus the one without frt")
	assert.EqualValues(t, 15000, short.TotalUseTimeMs, "2s + 4s + 6s + 3s")
	assert.EqualValues(t, 650, short.CompletionTokens)
	assert.EqualValues(t, 3000, short.TtftSumMs, "500ms + 1000ms + 1500ms")
	assert.EqualValues(t, 3, short.TtftCount, "the -1000 sentinel is not a measurement")
}

func TestSumPromptScopedStatsNarrowsToRequestedModel(t *testing.T) {
	db := setupPromptScopeLogDB(t)
	hour := int64(1_800_000_000)
	rows := []Log{
		{Type: LogTypeConsume, CreatedAt: hour + 60, ModelName: "model-a", Group: "default", PromptTokens: 500, CompletionTokens: 100, UseTime: 2, Other: `{"frt":500}`},
		{Type: LogTypeConsume, CreatedAt: hour + 120, ModelName: "model-b", Group: "default", PromptTokens: 500, CompletionTokens: 100, UseTime: 9, Other: `{"frt":9000}`},
		{Type: LogTypeConsume, CreatedAt: hour + 3600, ModelName: "model-a", Group: "vip", PromptTokens: 500, CompletionTokens: 300, UseTime: 4, Other: `{"frt":1000}`},
	}
	require.NoError(t, db.Create(&rows).Error)

	groupStats, err := SumPromptScopedStats(hour, 8000, PromptScopedByGroup, "model-a")
	require.NoError(t, err)
	require.Len(t, groupStats, 2, "another model's group rows stay out")
	byGroup := map[string]PromptScopedStat{}
	for _, stat := range groupStats {
		byGroup[stat.Key] = stat
	}
	assert.EqualValues(t, 2000, byGroup["default"].TotalUseTimeMs)
	assert.EqualValues(t, 4000, byGroup["vip"].TotalUseTimeMs)

	hourStats, err := SumPromptScopedStats(hour, 8000, PromptScopedByHour, "model-a")
	require.NoError(t, err)
	require.Len(t, hourStats, 2)
	assert.Equal(t, hour, hourStats[0].BucketTs, "the earlier hour sorts first")
	assert.EqualValues(t, 2000, hourStats[0].TotalUseTimeMs)
	assert.Equal(t, hour+3600, hourStats[1].BucketTs)
	assert.Empty(t, hourStats[0].Key, "hour rows carry their bucket in bucket_ts")
}
