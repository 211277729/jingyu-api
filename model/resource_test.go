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

// setupResourceTestDB 建立只含 resources 表的临时库并替换全局 DB。
func setupResourceTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := "file:" + filepath.ToSlash(filepath.Join(t.TempDir(), "resource_test.db"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{},
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Resource{}))
	previousDB := DB
	DB = db
	t.Cleanup(func() {
		DB = previousDB
		_ = sqlDB.Close()
	})
	return db
}

func newTestResource(slug string, kind string, sortOrder int, enabled bool) *Resource {
	return &Resource{
		Slug:           slug,
		Name:           slug,
		Kind:           kind,
		Vendor:         ResourceVendorOfficial,
		Tags:           `["web"]`,
		SummaryZh:      "中文简介",
		SummaryEn:      "english summary",
		DescriptionZh:  "中文描述",
		DescriptionEn:  "english description",
		HighlightsZh:   `["亮点"]`,
		HighlightsEn:   `["highlight"]`,
		InstallCommand: "npm install -g demo",
		SortOrder:      sortOrder,
		Enabled:        enabled,
	}
}

func TestResourceInsertAndLookup(t *testing.T) {
	setupResourceTestDB(t)

	resource := newTestResource("mcp-fetch", ResourceKindMCP, 10, true)
	require.NoError(t, resource.Insert())
	require.NotZero(t, resource.Id)
	require.NotZero(t, resource.CreatedAt)

	bySlug, err := GetResourceBySlug("mcp-fetch")
	require.NoError(t, err)
	assert.Equal(t, resource.Id, bySlug.Id)
	assert.Equal(t, "mcp-fetch", bySlug.Slug)

	byId, err := GetResourceById(resource.Id)
	require.NoError(t, err)
	assert.Equal(t, "mcp-fetch", byId.Slug)

	_, err = GetResourceBySlug("missing")
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

func TestResourceSlugExists(t *testing.T) {
	setupResourceTestDB(t)

	resource := newTestResource("mcp-git", ResourceKindMCP, 0, true)
	require.NoError(t, resource.Insert())

	exists, err := ResourceSlugExists("mcp-git", 0)
	require.NoError(t, err)
	assert.True(t, exists)

	// 更新自身时排除自己，不应判定为占用
	exists, err = ResourceSlugExists("mcp-git", resource.Id)
	require.NoError(t, err)
	assert.False(t, exists)

	exists, err = ResourceSlugExists("mcp-memory", 0)
	require.NoError(t, err)
	assert.False(t, exists)
}

func TestGetEnabledResourcesOrderAndFilter(t *testing.T) {
	setupResourceTestDB(t)

	require.NoError(t, newTestResource("beta", ResourceKindMCP, 20, true).Insert())
	require.NoError(t, newTestResource("alpha", ResourceKindMCP, 10, true).Insert())
	require.NoError(t, newTestResource("hidden", ResourceKindSkill, 0, false).Insert())

	items, err := GetEnabledResources()
	require.NoError(t, err)
	require.Len(t, items, 2)
	assert.Equal(t, "alpha", items[0].Slug)
	assert.Equal(t, "beta", items[1].Slug)
}

func TestGetResourcePageFilters(t *testing.T) {
	setupResourceTestDB(t)

	require.NoError(t, newTestResource("mcp-fetch", ResourceKindMCP, 10, true).Insert())
	require.NoError(t, newTestResource("mcp-git", ResourceKindMCP, 20, false).Insert())
	skill := newTestResource("skill-docx", ResourceKindSkill, 30, true)
	skill.Name = "Docx Writer"
	require.NoError(t, skill.Insert())

	items, total, err := GetResourcePage("", "", "", 0, 10)
	require.NoError(t, err)
	assert.EqualValues(t, 3, total)
	require.Len(t, items, 3)

	items, total, err = GetResourcePage(ResourceKindMCP, "", "", 0, 10)
	require.NoError(t, err)
	assert.EqualValues(t, 2, total)
	assert.Len(t, items, 2)

	items, total, err = GetResourcePage("", "", "true", 0, 10)
	require.NoError(t, err)
	assert.EqualValues(t, 2, total)
	assert.Len(t, items, 2)

	// 关键字大小写不敏感，且能命中 name 与 slug
	items, total, err = GetResourcePage("", "DOCX", "", 0, 10)
	require.NoError(t, err)
	assert.EqualValues(t, 1, total)
	require.Len(t, items, 1)
	assert.Equal(t, "skill-docx", items[0].Slug)

	// 分页：第一页一条，剩余从第二页开始
	items, total, err = GetResourcePage("", "", "", 0, 1)
	require.NoError(t, err)
	assert.EqualValues(t, 3, total)
	assert.Len(t, items, 1)
	assert.Equal(t, "mcp-fetch", items[0].Slug)
}

func TestResourceUpdateKeepsDisabledState(t *testing.T) {
	setupResourceTestDB(t)

	resource := newTestResource("mcp-memory", ResourceKindMCP, 5, true)
	require.NoError(t, resource.Insert())

	resource.Enabled = false
	resource.SortOrder = 0
	resource.Name = "Memory"
	require.NoError(t, resource.Update())

	reloaded, err := GetResourceById(resource.Id)
	require.NoError(t, err)
	assert.False(t, reloaded.Enabled)
	assert.Equal(t, 0, reloaded.SortOrder)
	assert.Equal(t, "Memory", reloaded.Name)
}

func TestResourceDelete(t *testing.T) {
	setupResourceTestDB(t)

	resource := newTestResource("mcp-postgres", ResourceKindMCP, 0, true)
	require.NoError(t, resource.Insert())

	require.NoError(t, resource.Delete())
	_, err := GetResourceById(resource.Id)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

// TestResourceAutoMigrateBackfillsContent 老库升级：表里还没有 content 列时，
// AutoMigrate 必须能补上，并且历史行读出来是空串（而不是 NULL 扫描报错）。
func TestResourceAutoMigrateBackfillsContent(t *testing.T) {
	dsn := "file:" + filepath.ToSlash(filepath.Join(t.TempDir(), "resource_migrate_test.db"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{},
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })

	// 上一版建出来的 resources 表：没有 content 列
	require.NoError(t, db.Exec(`CREATE TABLE resources (
		id integer PRIMARY KEY AUTOINCREMENT,
		slug varchar(64) NOT NULL,
		name varchar(128) NOT NULL,
		kind varchar(16) NOT NULL,
		vendor varchar(16) NOT NULL,
		sort_order integer NOT NULL,
		enabled numeric NOT NULL
	)`).Error)
	require.NoError(t, db.Exec(`INSERT INTO resources (slug, name, kind, vendor, sort_order, enabled)
		VALUES ('old-skill', 'Old', 'skill', 'Official', 0, 1)`).Error)

	require.NoError(t, db.AutoMigrate(&Resource{}))

	previousDB := DB
	DB = db
	t.Cleanup(func() { DB = previousDB })

	item, err := GetResourceBySlug("old-skill")
	require.NoError(t, err)
	assert.Equal(t, "", item.Content)
}
