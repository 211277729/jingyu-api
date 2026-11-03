package model

import (
	"path/filepath"
	"time"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// setupHiddenModelTestDB 建立包含模型元数据/渠道/能力表的临时库，
// IsModelHidden 首次触发的 updatePricing 会从该库构建隐藏缓存。
func setupHiddenModelTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := "file:" + filepath.ToSlash(filepath.Join(t.TempDir(), "hidden_model_test.db"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{},
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Model{}, &Channel{}, &Ability{}, &Vendor{}))
	previousDB := DB
	DB = db
	t.Cleanup(func() {
		DB = previousDB
		// 重置包级隐藏缓存，避免跨用例命中上一用例的 TTL
		hiddenModelLock.Lock()
		hiddenModelExact = make(map[string]struct{})
		hiddenModelRules = nil
		hiddenModelLastBuild = time.Time{}
		hiddenModelLock.Unlock()
		_ = sqlDB.Close()
	})
	return db
}

func TestIsModelHidden(t *testing.T) {
	db := setupHiddenModelTestDB(t)

	require.NoError(t, db.Create(&[]Model{
		{ModelName: "gpt-secret", NameRule: NameRuleExact},
		{ModelName: "claude-old", NameRule: NameRulePrefix},
		{ModelName: "gpt-ok", NameRule: NameRuleExact},
	}).Error)
	// Status 带 gorm default:1，零值 0 需显式 Update 才能落库（与 Insert() 的两步写一致）
	require.NoError(t, db.Model(&Model{}).Where("model_name = ?", "gpt-secret").Update("status", 0).Error)
	require.NoError(t, db.Model(&Model{}).Where("model_name = ?", "claude-old").Update("status", 2).Error)

	tests := []struct {
		name  string
		model string
		want  bool
	}{
		{"精确匹配的隐藏模型", "gpt-secret", true},
		{"前缀规则命中", "claude-old-20240101", true},
		{"前缀规则不命中", "claude-new", false},
		{"正常模型不受影响", "gpt-ok", false},
		{"未登记模型不受影响", "unknown-model", false},
		{"空模型名", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, IsModelHidden(tt.model))
		})
	}
}

func TestFilterHiddenModels(t *testing.T) {
	db := setupHiddenModelTestDB(t)

	require.NoError(t, db.Create(&[]Model{
		{ModelName: "hidden-a", NameRule: NameRuleExact},
		{ModelName: "hidden-b-", NameRule: NameRuleContains},
	}).Error)
	require.NoError(t, db.Model(&Model{}).Where("model_name IN ?", []string{"hidden-a", "hidden-b-"}).Update("status", 0).Error)

	got := FilterHiddenModels([]string{"hidden-a", "x-hidden-b-y", "visible", "hidden-a"})
	assert.Equal(t, []string{"visible"}, got)
	assert.Equal(t, []string{}, FilterHiddenModels(nil))
}
