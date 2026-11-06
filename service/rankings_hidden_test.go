package service

import (
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// setupRankingHiddenTestDB 建立包含模型元数据/渠道/能力表的临时库，
// 使 rankingModelKeepFilter 触发的 updatePricing 能构建隐藏缓存与定价表。
func setupRankingHiddenTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := "file:" + filepath.ToSlash(filepath.Join(t.TempDir(), "rankings_keep_test.db"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{},
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Model{}, &model.Channel{}, &model.Ability{}, &model.Vendor{}))
	previousDB := model.DB
	model.DB = db
	t.Cleanup(func() {
		model.DB = previousDB
		_ = sqlDB.Close()
	})
	return db
}

func TestRankingModelKeepFilter(t *testing.T) {
	db := setupRankingHiddenTestDB(t)

	// 有启用渠道的模型会进入定价表（via abilities）；gpt-secret 被下架
	require.NoError(t, db.Create(&[]model.Model{
		{ModelName: "gpt-secret", NameRule: model.NameRuleExact},
		{ModelName: "gpt-ok", NameRule: model.NameRuleExact},
	}).Error)
	// Status 带 gorm default:1，零值需显式 Update 落库
	require.NoError(t, db.Model(&model.Model{}).Where("model_name = ?", "gpt-secret").Update("status", 0).Error)
	// 渠道 + 能力：让 gpt-ok 出现在定价表
	require.NoError(t, db.Create(&model.Channel{Models: "gpt-ok"}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "gpt-ok", ChannelId: 1, Enabled: true},
	}).Error)

	meta := buildRankingModelMeta()
	keep := rankingModelKeepFilter(meta)

	_, okKept := keep["gpt-ok"]
	assert.True(t, okKept, "当前可路由且未下架的模型应保留")
	_, okHidden := keep["gpt-secret"]
	assert.False(t, okHidden, "已下架模型应被剔除")
	_, okLegacy := keep["cn:deepseek-v4.1-flash"]
	assert.False(t, okLegacy, "不在定价表的历史残留模型名应被剔除")
}

func TestFilterRankingTotals(t *testing.T) {
	db := setupRankingHiddenTestDB(t)
	require.NoError(t, db.Create(&[]model.Model{
		{ModelName: "gpt-ok", NameRule: model.NameRuleExact},
	}).Error)
	require.NoError(t, db.Create(&model.Channel{Models: "gpt-ok"}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "gpt-ok", ChannelId: 1, Enabled: true},
	}).Error)

	meta := buildRankingModelMeta()
	keep := rankingModelKeepFilter(meta)

	rows := []model.RankingQuotaTotal{
		{ModelName: "cn:deepseek-v4.1-flash", TotalTokens: 188},
		{ModelName: "gpt-secret", TotalTokens: 9999},
		{ModelName: "gpt-ok", TotalTokens: 100},
	}

	filtered := filterRankingTotals(rows, keep)

	require.Len(t, filtered, 1)
	assert.Equal(t, "gpt-ok", filtered[0].ModelName)
}

func TestFilterRankingBuckets(t *testing.T) {
	db := setupRankingHiddenTestDB(t)
	require.NoError(t, db.Create(&[]model.Model{
		{ModelName: "gpt-ok", NameRule: model.NameRuleExact},
	}).Error)
	require.NoError(t, db.Create(&model.Channel{Models: "gpt-ok"}).Error)
	require.NoError(t, db.Create(&[]model.Ability{
		{Group: "default", Model: "gpt-ok", ChannelId: 1, Enabled: true},
	}).Error)

	meta := buildRankingModelMeta()
	keep := rankingModelKeepFilter(meta)

	rows := []model.RankingQuotaBucket{
		{ModelName: "cn:deepseek-v4-flash", Bucket: 1000, Tokens: 141},
		{ModelName: "gpt-ok", Bucket: 1000, Tokens: 100},
		{ModelName: "gpt-ok", Bucket: 2000, Tokens: 300},
	}

	filtered := filterRankingBuckets(rows, keep)

	require.Len(t, filtered, 2)
	assert.Equal(t, "gpt-ok", filtered[0].ModelName)
	assert.Equal(t, int64(1000), filtered[0].Bucket)
	assert.Equal(t, "gpt-ok", filtered[1].ModelName)
	assert.Equal(t, int64(2000), filtered[1].Bucket)
}
