package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupContextGuardRouter(t *testing.T, maxTokens int) *gin.Engine {
	t.Helper()
	require.NoError(t, i18n.Init())
	gin.SetMode(gin.TestMode)
	oldMax := setting.ContextLengthGuardMaxTokens
	oldIdle := setting.ContextLengthGuardIdleMinutes
	setting.ContextLengthGuardMaxTokens = maxTokens
	setting.ContextLengthGuardIdleMinutes = 10
	t.Cleanup(func() {
		setting.ContextLengthGuardMaxTokens = oldMax
		setting.ContextLengthGuardIdleMinutes = oldIdle
		contextGuardUsers = sync.Map{}
		atomic.StoreInt64(&contextGuardLastSeenCount, 0)
		atomic.StoreInt64(&contextGuardLastSweepAt, 0)
	})

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("id", 42)
		c.Next()
	})
	router.POST("/v1/chat/completions", ContextLengthGuard(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	router.POST("/v1/messages", ContextLengthGuard(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	router.POST("/v1/responses/compact", ContextLengthGuard(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	return router
}

func contextGuardPost(router *gin.Engine, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

// 小请求正常放行
func TestContextLengthGuardAllowsSmallRequest(t *testing.T) {
	router := setupContextGuardRouter(t, 1000)
	w := contextGuardPost(router, "/v1/chat/completions", `{"model":"gpt-4","messages":[{"role":"user","content":"hi"}]}`)
	assert.Equal(t, http.StatusOK, w.Code)
}

// 超限请求被拦截，文案包含 /compact 指引
func TestContextLengthGuardBlocksOversizedRequest(t *testing.T) {
	router := setupContextGuardRouter(t, 100)
	big := strings.Repeat("a", 800) // ascii/4 = 200 tokens > 100
	w := contextGuardPost(router, "/v1/chat/completions", `{"model":"gpt-4","messages":[{"role":"user","content":"`+big+`"}]}`)
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "/compact")
}

// 活跃窗口内的超长请求放行（任务进行中不打断）
func TestContextLengthGuardAllowsActiveSession(t *testing.T) {
	router := setupContextGuardRouter(t, 100)
	small := `{"model":"gpt-4","messages":[{"role":"user","content":"hi"}]}`
	assert.Equal(t, http.StatusOK, contextGuardPost(router, "/v1/chat/completions", small).Code)
	// 上一请求刷新了活跃时间，紧随其后的超长请求应放行
	big := `{"model":"gpt-4","messages":[{"role":"user","content":"` + strings.Repeat("a", 800) + `"}]}`
	assert.Equal(t, http.StatusOK, contextGuardPost(router, "/v1/chat/completions", big).Code)
}

// 被拦截后紧随的压缩请求落在活跃窗口内，也能放行（保证 /compact 可用）
func TestContextLengthGuardAllowsCompactAfterBlock(t *testing.T) {
	router := setupContextGuardRouter(t, 100)
	big := `{"model":"gpt-4","messages":[{"role":"user","content":"` + strings.Repeat("a", 800) + `"}]}`
	assert.Equal(t, http.StatusBadRequest, contextGuardPost(router, "/v1/chat/completions", big).Code)
	assert.Equal(t, http.StatusOK, contextGuardPost(router, "/v1/chat/completions", big).Code)
}

// 活跃时间必须随每次请求刷新：条目已存在但已过期时（对应进程运行一段时间后
// 用户隔了十几分钟才回来继续任务），超长请求应被拦截而不是永远算作活跃。
// 回归场景：对已存在的条目不覆盖写入时间，窗口永久停留在第一个请求上。
func TestContextLengthGuardExpiredWindowBlocksAgain(t *testing.T) {
	router := setupContextGuardRouter(t, 100)
	// 种子一个早已过期的活跃条目，模拟用户很久没来
	contextGuardUsers.Store(42, &contextGuardUserState{lastSeen: time.Now().Add(-30 * time.Minute).Unix()})
	atomic.StoreInt64(&contextGuardLastSeenCount, 1)

	big := `{"model":"gpt-4","messages":[{"role":"user","content":"` + strings.Repeat("a", 800) + `"}]}`
	assert.Equal(t, http.StatusBadRequest, contextGuardPost(router, "/v1/chat/completions", big).Code)

	// 被拦截会刷新活跃时间，紧随其后的压缩请求（同样超长）应放行
	assert.Equal(t, http.StatusOK, contextGuardPost(router, "/v1/chat/completions", big).Code)
}

// 连续豁免上限：活跃用户连发超长请求达到上限后开始拦截，被拦后进入宽限期
// （压缩请求能放行）；压缩成功后的正常请求把额度清零，恢复正常豁免。
func TestContextLengthGuardExemptLimit(t *testing.T) {
	router := setupContextGuardRouter(t, 100)
	setting.ContextLengthGuardExemptLimit = 2
	big := `{"model":"gpt-4","messages":[{"role":"user","content":"` + strings.Repeat("a", 800) + `"}]}`
	small := `{"model":"gpt-4","messages":[{"role":"user","content":"hi"}]}`

	// 先正常请求一次建立活跃会话
	assert.Equal(t, http.StatusOK, contextGuardPost(router, "/v1/chat/completions", small).Code)
	// 连发 2 条超长请求：都在豁免额度内放行
	assert.Equal(t, http.StatusOK, contextGuardPost(router, "/v1/chat/completions", big).Code)
	assert.Equal(t, http.StatusOK, contextGuardPost(router, "/v1/chat/completions", big).Code)
	// 第 3 条：额度用尽，活跃会话中也拦截
	assert.Equal(t, http.StatusBadRequest, contextGuardPost(router, "/v1/chat/completions", big).Code)
	// 被拦后进入宽限期（计数已清零），压缩请求（同样超长）放行；
	// 宽限期内继续硬连发，第 3 条再次被拦
	assert.Equal(t, http.StatusOK, contextGuardPost(router, "/v1/chat/completions", big).Code)
	assert.Equal(t, http.StatusOK, contextGuardPost(router, "/v1/chat/completions", big).Code)
	assert.Equal(t, http.StatusBadRequest, contextGuardPost(router, "/v1/chat/completions", big).Code)

	// 模拟用户真的压缩了：来一条不超长的正常请求，额度清零
	assert.Equal(t, http.StatusOK, contextGuardPost(router, "/v1/chat/completions", small).Code)
	assert.Equal(t, http.StatusOK, contextGuardPost(router, "/v1/chat/completions", big).Code)
	assert.Equal(t, http.StatusOK, contextGuardPost(router, "/v1/chat/completions", big).Code)
	// 清零后额度重新可用 2 条，第 3 条被拦
	assert.Equal(t, http.StatusBadRequest, contextGuardPost(router, "/v1/chat/completions", big).Code)
}

// /responses/compact 端点本身不拦
func TestContextLengthGuardSkipsCompactEndpoint(t *testing.T) {
	router := setupContextGuardRouter(t, 100)
	big := `{"model":"gpt-4","input":"` + strings.Repeat("a", 800) + `"}`
	assert.Equal(t, http.StatusOK, contextGuardPost(router, "/v1/responses/compact", big).Code)
}

// base64 图片字段不计入估算，避免误杀带图请求
func TestContextLengthGuardSkipsImageData(t *testing.T) {
	router := setupContextGuardRouter(t, 100)
	big := strings.Repeat("a", 800)
	body := `{"model":"gpt-4","messages":[{"role":"user","content":[{"type":"text","text":"hi"},{"type":"image_url","image_url":{"url":"data:image/png;base64,` + big + `"}}]}]}`
	assert.Equal(t, http.StatusOK, contextGuardPost(router, "/v1/chat/completions", body).Code)
}

// 键名、数字、普通文本字段（如 MCP 工具返回的 data/url）都计入估算——
// 之前按字段名跳过 data/url 导致大段工具输出漏算，估算比实际低近 40%
func TestContextLengthGuardCountsKeysNumbersAndPlainDataFields(t *testing.T) {
	router := setupContextGuardRouter(t, 100)
	// "data" 字段装的是普通文本而非 base64，必须计入；"role" 等键名也计入
	// "data" 字段装的是普通文本而非 base64，必须计入；"role" 等键名也计入
	// 300 个 ASCII 字符 + 键名 ≈ 102 tokens > 100
	plain := strings.Repeat("b", 300)
	body := `{"model":"gpt-4","messages":[{"role":"assistant","content":"ok","data":"` + plain + `"}]}`
	assert.Equal(t, http.StatusBadRequest, contextGuardPost(router, "/v1/chat/completions", body).Code)
}

// 长 base64 内容按特征识别跳过（而非字段名），正常长文本不受影响
func TestContextLengthGuardBase64ByContent(t *testing.T) {
	router := setupContextGuardRouter(t, 100)
	// 纯 base64 字符串（>512 长度、无空格）跳过
	b64 := strings.Repeat("QUJD", 300) // 1200 base64 chars
	// 同样长度的自然语言文本（有空格）不跳过
	plain := strings.Repeat("hello world ", 100)
	body := `{"model":"gpt-4","messages":[{"role":"user","content":[{"type":"image_url","image_url":{"url":"data:image/png;base64,` + b64 + `"}},{"type":"text","text":"` + plain + `"}]}]}`
	// base64 跳过 + 图片容器跳过，text 1200 ascii/3 = 400 > 100 超限
	assert.Equal(t, http.StatusBadRequest, contextGuardPost(router, "/v1/chat/completions", body).Code)
}

// 后台自定义文案优先生效，占位符被渲染
func TestContextLengthGuardCustomMessage(t *testing.T) {
	router := setupContextGuardRouter(t, 100)
	oldMsg := setting.ContextLengthGuardMessage
	setting.ContextLengthGuardMessage = "内容太长啦（{{.Tokens}}），请让家人帮您输入 /compact，上限是 {{.Max}}"
	t.Cleanup(func() { setting.ContextLengthGuardMessage = oldMsg })

	big := strings.Repeat("a", 800)
	w := contextGuardPost(router, "/v1/chat/completions", `{"model":"gpt-4","messages":[{"role":"user","content":"`+big+`"}]}`)
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "内容太长啦（282），请让家人帮您输入 /compact，上限是 100")
}

// 坏模板不会崩，回退内置 i18n 文案
func TestContextLengthGuardBadTemplateFallsBack(t *testing.T) {
	router := setupContextGuardRouter(t, 100)
	oldMsg := setting.ContextLengthGuardMessage
	setting.ContextLengthGuardMessage = "模板写错了 {{.Oops"
	t.Cleanup(func() { setting.ContextLengthGuardMessage = oldMsg })

	big := strings.Repeat("a", 800)
	w := contextGuardPost(router, "/v1/chat/completions", `{"model":"gpt-4","messages":[{"role":"user","content":"`+big+`"}]}`)
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "/compact")
}

// Claude 原生端点返回 Anthropic 错误结构
func TestContextLengthGuardClaudeErrorShape(t *testing.T) {
	router := setupContextGuardRouter(t, 100)
	big := strings.Repeat("a", 800)
	w := contextGuardPost(router, "/v1/messages", `{"model":"claude-3","messages":[{"role":"user","content":"`+big+`"}]}`)
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), `"type":"error"`)
	assert.Contains(t, w.Body.String(), "invalid_request_error")
}
