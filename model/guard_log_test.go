package model

import (
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// setupGuardLogTestDB 建立包含 guard_logs 表的临时库并替换全局 DB。
func setupGuardLogTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := "file:" + filepath.ToSlash(filepath.Join(t.TempDir(), "guard_log_test.db"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{},
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&GuardLog{}))
	previousDB := DB
	DB = db
	// 清空缓冲，避免跨用例污染
	guardBuffer.Lock()
	guardBuffer.pending = nil
	guardBuffer.Unlock()
	t.Cleanup(func() {
		DB = previousDB
		_ = sqlDB.Close()
	})
	return db
}

func TestRecordGuardLogBuffersAndFlushes(t *testing.T) {
	setupGuardLogTestDB(t)
	RecordGuardLog(GuardLog{UserId: 1, Username: "u1", EstimatedTokens: 500000, MaxTokens: 400000, Decision: GuardDecisionBlocked})
	RecordGuardLog(GuardLog{UserId: 2, Username: "u2", Decision: GuardDecisionAllowedActive})

	guardBuffer.Lock()
	require.Len(t, guardBuffer.pending, 2)
	day := guardBuffer.pending[0].Day
	guardBuffer.Unlock()
	assert.NotEmpty(t, day)

	FlushGuardLogBuffer()
	guardBuffer.Lock()
	assert.Empty(t, guardBuffer.pending)
	guardBuffer.Unlock()

	var count int64
	DB.Model(&GuardLog{}).Count(&count)
	assert.Equal(t, int64(2), count)
}

func TestGetGuardStatsAndLogs(t *testing.T) {
	setupGuardLogTestDB(t)
	RecordGuardLog(GuardLog{UserId: 1, Username: "u1", EstimatedTokens: 900000, BodyBytes: 3600000, Decision: GuardDecisionBlocked})
	RecordGuardLog(GuardLog{UserId: 1, Username: "u1", EstimatedTokens: 600000, BodyBytes: 2400000, Decision: GuardDecisionBlocked})
	RecordGuardLog(GuardLog{UserId: 2, Username: "u2", Decision: GuardDecisionAllowedActive})
	FlushGuardLogBuffer()

	stats, err := GetGuardStats()
	require.NoError(t, err)
	assert.Equal(t, int64(3), stats.TotalToday)
	assert.Equal(t, 2, len(stats.Today)) // 两个决策维度各一条
	assert.Equal(t, 900000, stats.MaxTokens)
	assert.Equal(t, int64(3600000), stats.MaxBytes)
	require.Len(t, stats.TopUsers, 2)
	assert.Equal(t, "u1", stats.TopUsers[0].Username)
	assert.Equal(t, int64(2), stats.TopUsers[0].Count)

	logs, total, err := GetGuardLogs(GuardDecisionBlocked, "", 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(2), total)
	require.Len(t, logs, 2)
	// 明细按 id 倒序，最新在前
	assert.Equal(t, 600000, logs[0].EstimatedTokens)

	_, total, err = GetGuardLogs(0, "u2", 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(1), total)
}
