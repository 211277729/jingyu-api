package controller

import (
	"encoding/xml"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// setupSitemapDB 用文件型 sqlite 搭建 resources 与 abilities 表（复用资源控制
// 测试的经验：:memory: 在多连接下会丢表）。
func setupSitemapDB(t *testing.T) {
	t.Helper()
	dsn := "file:" + filepath.ToSlash(filepath.Join(t.TempDir(), "sitemap_test.db"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{},
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Resource{}, &model.Ability{}))

	previousDB := model.DB
	model.DB = db
	t.Cleanup(func() {
		model.DB = previousDB
		_ = sqlDB.Close()
	})
}

func requestSitemap(t *testing.T) (*httptest.ResponseRecorder, sitemapURLSet) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/sitemap.xml", nil)
	GetSitemap(ctx)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "application/xml; charset=utf-8", recorder.Header().Get("Content-Type"))

	var doc sitemapURLSet
	require.NoError(t, xml.Unmarshal(recorder.Body.Bytes(), &doc))
	return recorder, doc
}

func findSitemapLoc(doc sitemapURLSet, suffix string) (sitemapURL, bool) {
	for _, entry := range doc.URLs {
		if strings.HasSuffix(entry.Loc, suffix) {
			return entry, true
		}
	}
	return sitemapURL{}, false
}

func TestGetSitemapStaticPages(t *testing.T) {
	setupSitemapDB(t)
	_, doc := requestSitemap(t)

	for _, path := range []string{"/", "/nav", "/pricing", "/rankings", "/resources", "/docs", "/about", "/agent-program"} {
		entry, ok := findSitemapLoc(doc, path)
		require.True(t, ok, "sitemap 缺少固定页面 %s", path)
		assert.NotEmpty(t, entry.Loc)
	}
	// 首页优先级最高
	home, ok := findSitemapLoc(doc, "/")
	require.True(t, ok)
	assert.Equal(t, "1.0", home.Priority)
}

func TestGetSitemapIncludesResources(t *testing.T) {
	setupSitemapDB(t)
	seedControllerResource(t, "fetch-mcp", true)
	seedControllerResource(t, "disabled-tool", false)

	_, doc := requestSitemap(t)

	entry, ok := findSitemapLoc(doc, "/resources/fetch-mcp")
	require.True(t, ok, "启用的资源应进入 sitemap")
	assert.Contains(t, entry.LastMod, time.Now().Format("2006-01-02")[:4], "lastmod 应为日期格式")

	_, ok = findSitemapLoc(doc, "/resources/disabled-tool")
	assert.False(t, ok, "停用的资源不应进入 sitemap")
}

func TestGetSitemapEscapesModelNames(t *testing.T) {
	setupSitemapDB(t)
	// 模型名带斜杠和点号，必须逐段转义后仍是合法 URL
	model.DB.Create(&model.Ability{Group: "default", Model: "deepseek-ai/deepseek-v3", ChannelId: 1, Enabled: true})
	model.DB.Create(&model.Ability{Group: "default", Model: "gpt-4.1", ChannelId: 1, Enabled: true})
	model.DB.Create(&model.Ability{Group: "default", Model: "off-model", ChannelId: 1, Enabled: false})

	_, doc := requestSitemap(t)

	entry, ok := findSitemapLoc(doc, "/pricing/deepseek-ai%2Fdeepseek-v3")
	require.True(t, ok, "含斜杠的模型名应转义进 sitemap，实际 URL 列表: %v", doc.URLs)
	parsed, err := url.Parse(entry.Loc)
	require.NoError(t, err)
	assert.Equal(t, "deepseek-ai/deepseek-v3", parsed.Path[len("/pricing/"):], "转义后的模型名应能还原")

	_, ok = findSitemapLoc(doc, "/pricing/gpt-4.1")
	assert.True(t, ok)

	_, ok = findSitemapLoc(doc, "/pricing/off-model")
	assert.False(t, ok, "停用的模型不应进入 sitemap")
}

func TestGetSitemapUsesServerAddress(t *testing.T) {
	setupSitemapDB(t)
	previous := system_setting.ServerAddress
	system_setting.ServerAddress = "https://example.test/"
	t.Cleanup(func() { system_setting.ServerAddress = previous })

	_, doc := requestSitemap(t)

	home, ok := findSitemapLoc(doc, "/")
	require.True(t, ok)
	assert.Equal(t, "https://example.test/", home.Loc, "末尾斜杠应被去掉且域名取自 ServerAddress")
}
