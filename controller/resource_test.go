package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// setupResourceControllerDB 用文件型 sqlite（:memory: 在多连接下会丢表）搭建 resources 表。
func setupResourceControllerDB(t *testing.T) {
	t.Helper()
	dsn := "file:" + filepath.ToSlash(filepath.Join(t.TempDir(), "resource_controller_test.db"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{},
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Resource{}))

	previousDB := model.DB
	model.DB = db
	t.Cleanup(func() {
		model.DB = previousDB
		_ = sqlDB.Close()
	})
}

func seedControllerResource(t *testing.T, slug string, enabled bool) *model.Resource {
	t.Helper()
	resource := &model.Resource{
		Slug:          slug,
		Name:          slug,
		Kind:          model.ResourceKindMCP,
		Vendor:        model.ResourceVendorOfficial,
		Tags:          `["web"]`,
		SummaryZh:     "抓网页",
		SummaryEn:     "fetch pages",
		DescriptionZh: "描述",
		DescriptionEn: "description",
		HighlightsZh:  `["亮点"]`,
		HighlightsEn:  `["highlight"]`,
		Content:       "## 快速开始",
		McpConfig:     `{"name":"` + slug + `","command":"uvx","args":["mcp-server-fetch"]}`,
		Enabled:       enabled,
	}
	require.NoError(t, resource.Insert())
	return resource
}

func runResourceHandler(
	t *testing.T,
	handler gin.HandlerFunc,
	method string,
	target string,
	body any,
	params gin.Params,
) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	var reader *bytes.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		require.NoError(t, err)
		reader = bytes.NewReader(payload)
	} else {
		reader = bytes.NewReader(nil)
	}
	ctx.Request = httptest.NewRequest(method, target, reader)
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Params = params
	handler(ctx)
	return recorder
}

type resourceTestResponse struct {
	Success    bool   `json:"success"`
	Message    string `json:"message"`
	MessageKey string `json:"message_key"`
	Data       struct {
		Items []struct {
			Slug    string `json:"slug"`
			Kind    string `json:"kind"`
			Enabled bool   `json:"enabled"`
			Tags    []string
			Summary struct{ Zh, En string }
			Content string `json:"content"`
			Mcp     *struct{ Command string }
		} `json:"items"`
		Total int64  `json:"total"`
		Id    int    `json:"id"`
		Slug  string `json:"slug"`
	} `json:"data"`
}

func decodeResourceResponse(t *testing.T, recorder *httptest.ResponseRecorder) resourceTestResponse {
	t.Helper()
	response := resourceTestResponse{}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}

func TestGetPublicResourceListOnlyEnabled(t *testing.T) {
	setupResourceControllerDB(t)
	seedControllerResource(t, "mcp-fetch", true)
	seedControllerResource(t, "mcp-hidden", false)

	recorder := runResourceHandler(t, GetPublicResourceList, http.MethodGet, "/api/resource/list", nil, nil)
	require.Equal(t, http.StatusOK, recorder.Code)
	response := decodeResourceResponse(t, recorder)
	require.True(t, response.Success)
	require.Len(t, response.Data.Items, 1)
	assert.Equal(t, "mcp-fetch", response.Data.Items[0].Slug)
	assert.Equal(t, []string{"web"}, response.Data.Items[0].Tags)
	assert.Equal(t, "抓网页", response.Data.Items[0].Summary.Zh)
	assert.Equal(t, "## 快速开始", response.Data.Items[0].Content)
	require.NotNil(t, response.Data.Items[0].Mcp)
	assert.Equal(t, "uvx", response.Data.Items[0].Mcp.Command)
}

func TestAddResourceRejectsInvalidPayload(t *testing.T) {
	setupResourceControllerDB(t)
	seedControllerResource(t, "mcp-taken", true)

	validMcp := &resourceMcpConfig{Name: "fetch", Command: "uvx", Args: []string{"mcp-server-fetch"}}
	basePayload := func() resourcePayload {
		return resourcePayload{
			Slug:      "mcp-new",
			Name:      "New",
			Kind:      model.ResourceKindMCP,
			Vendor:    model.ResourceVendorOfficial,
			SummaryZh: "简介",
			Mcp:       &resourceMcpConfig{Name: "new", Command: "uvx", Args: []string{"demo"}},
		}
	}

	cases := []struct {
		name    string
		mutate  func(*resourcePayload)
		wantKey string
	}{
		{
			name:    "missing slug",
			mutate:  func(p *resourcePayload) { p.Slug = "  " },
			wantKey: errResourceSlugRequired.Key,
		},
		{
			name:    "invalid slug",
			mutate:  func(p *resourcePayload) { p.Slug = "MCP New" },
			wantKey: errResourceSlugInvalid.Key,
		},
		{
			name:    "duplicate slug",
			mutate:  func(p *resourcePayload) { p.Slug = "mcp-taken" },
			wantKey: errResourceSlugTaken.Key,
		},
		{
			name:    "invalid kind",
			mutate:  func(p *resourcePayload) { p.Kind = "widget" },
			wantKey: errResourceKindInvalid.Key,
		},
		{
			name:    "missing summary",
			mutate:  func(p *resourcePayload) { p.SummaryZh = "" },
			wantKey: errResourceSummaryRequired.Key,
		},
		{
			name:    "mcp without config",
			mutate:  func(p *resourcePayload) { p.Mcp = nil },
			wantKey: errResourceMcpRequired.Key,
		},
		{
			name:    "mcp without command",
			mutate:  func(p *resourcePayload) { p.Mcp = &resourceMcpConfig{Name: "new"} },
			wantKey: errResourceMcpCommandRequired.Key,
		},
		{
			name:    "bad repo url",
			mutate:  func(p *resourcePayload) { p.RepoUrl = "github.com/example" },
			wantKey: errResourceUrlInvalid.Key,
		},
		{
			name:    "too many tags",
			mutate:  func(p *resourcePayload) { p.Tags = makeTooManyTags() },
			wantKey: errResourceTooManyItems.Key,
		},
	}

	for _, testCase := range cases {
		t.Run(testCase.name, func(t *testing.T) {
			payload := basePayload()
			testCase.mutate(&payload)
			recorder := runResourceHandler(t, AddResource, http.MethodPost, "/api/resource/admin/", payload, nil)
			response := decodeResourceResponse(t, recorder)
			assert.False(t, response.Success)
			assert.Equal(t, testCase.wantKey, response.MessageKey)
		})
	}

	// 合法 payload 必须能落库，并把非 mcp 类别的 mcp 配置清掉
	payload := basePayload()
	payload.InstallCommand = ""
	payload.Mcp = validMcp
	recorder := runResourceHandler(t, AddResource, http.MethodPost, "/api/resource/admin/", payload, nil)
	response := decodeResourceResponse(t, recorder)
	require.True(t, response.Success, response.Message)
	require.NotZero(t, response.Data.Id)

	toolPayload := basePayload()
	toolPayload.Slug = "tool-demo"
	toolPayload.Kind = model.ResourceKindAgentTool
	recorder = runResourceHandler(t, AddResource, http.MethodPost, "/api/resource/admin/", toolPayload, nil)
	require.True(t, decodeResourceResponse(t, recorder).Success)
	stored, err := model.GetResourceBySlug("tool-demo")
	require.NoError(t, err)
	assert.Empty(t, stored.McpConfig)
}

func makeTooManyTags() []string {
	tags := make([]string, 0, resourceTagMaxCount+1)
	for i := 0; i <= resourceTagMaxCount; i++ {
		tags = append(tags, "tag"+string(rune('a'+i)))
	}
	return tags
}

func TestUpdateAndDeleteResource(t *testing.T) {
	setupResourceControllerDB(t)
	resource := seedControllerResource(t, "mcp-git", true)

	update := resourcePayload{
		Id:           resource.Id,
		Slug:         "mcp-git",
		Name:         "Git",
		Kind:         model.ResourceKindMCP,
		Vendor:       model.ResourceVendorCommunity,
		SummaryEn:    "git ops",
		Tags:         []string{"vcs", "code"},
		Mcp:          &resourceMcpConfig{Name: "git", Command: "uvx", Args: []string{"mcp-server-git"}},
		SortOrder:    7,
		Enabled:      false,
		HighlightsZh: []string{"历史", "提交"},
		Content:      "## 用法\n\n- 第一步\n- 第二步",
	}
	recorder := runResourceHandler(t, UpdateResource, http.MethodPut, "/api/resource/admin/", update, nil)
	response := decodeResourceResponse(t, recorder)
	require.True(t, response.Success, response.Message)

	stored, err := model.GetResourceBySlug("mcp-git")
	require.NoError(t, err)
	assert.False(t, stored.Enabled)
	assert.Equal(t, 7, stored.SortOrder)
	assert.Equal(t, model.ResourceVendorCommunity, stored.Vendor)
	assert.JSONEq(t, `["vcs","code"]`, stored.Tags)
	assert.JSONEq(t, `["历史","提交"]`, stored.HighlightsZh)
	// Markdown 正文原样落库（换行不能丢，否则详情页排版全乱）
	assert.Equal(t, "## 用法\n\n- 第一步\n- 第二步", stored.Content)

	// 缺少 id 的更新必须被拒绝
	badUpdate := update
	badUpdate.Id = 0
	recorder = runResourceHandler(t, UpdateResource, http.MethodPut, "/api/resource/admin/", badUpdate, nil)
	assert.False(t, decodeResourceResponse(t, recorder).Success)

	// 删除后再查应为不存在
	recorder = runResourceHandler(t, DeleteResource, http.MethodDelete,
		"/api/resource/admin/1", nil, gin.Params{{Key: "id", Value: "1"}})
	require.True(t, decodeResourceResponse(t, recorder).Success)
	_, err = model.GetResourceById(resource.Id)
	assert.ErrorIs(t, err, gorm.ErrRecordNotFound)

	// 再删一次：404 语义
	recorder = runResourceHandler(t, DeleteResource, http.MethodDelete,
		"/api/resource/admin/1", nil, gin.Params{{Key: "id", Value: "1"}})
	response = decodeResourceResponse(t, recorder)
	assert.False(t, response.Success)
	assert.Equal(t, errResourceNotFound.Key, response.MessageKey)

	// 非法 id
	recorder = runResourceHandler(t, DeleteResource, http.MethodDelete,
		"/api/resource/admin/abc", nil, gin.Params{{Key: "id", Value: "abc"}})
	assert.Equal(t, errErrorInvalidResourceId.Key, decodeResourceResponse(t, recorder).MessageKey)
}
