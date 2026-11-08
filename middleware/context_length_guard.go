package middleware

import (
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"text/template"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// ContextLengthGuard 拦截输入 token 估算超限的请求，返回教用户压缩对话的文案。
//
// 目标是不懂技术的年长客户：prompt cache 让超长对话计费很便宜，但每次全量重传
// 的大 body 会挤占网关带宽，拖慢其他用户。拦截发生在 Distribute 之后、转发上游
// 之前，进站流量收完即止，不会传染给上游转发链路。
//
// 任务进行中不打断：按用户记录最近一次请求时间，活跃窗口内（默认 10 分钟）的
// 请求即使超长也放行——agent 工具多轮任务每轮请求间隔通常远小于窗口。
// 被拦截的请求同样刷新活跃时间：用户被拦后按文案输入 /compact 时，压缩请求
// 本身也是超长上下文，落在窗口内才能放行，压缩完成后上下文变小即恢复正常。
//
// 活跃窗口只看「最近有没有请求」，一个不停活跃的用户可以永远不压缩，守卫会
// 退化成只拦歇了一会儿再回来的人。ContextLengthGuardExemptLimit 用连续放行
// 计数补上这个口子：每次放行超长请求 +1，出现不超长请求（压缩成功的标志）
// 清零，达到上限后即使在活跃窗口内也拦截，拦截后清零重新计——用户每连发 N
// 条超长请求就被迫中断一次，直到真的压缩。
type contextGuardUserState struct {
	lastSeen int64 // 最近请求 unix 秒，活跃窗口与被拦后的宽限期都以此为基准
	count    int64 // 连续放行的超长请求数
}

var contextGuardUsers sync.Map // map[int]*contextGuardUserState

func ContextLengthGuard() gin.HandlerFunc {
	return func(c *gin.Context) {
		maxTokens := setting.ContextLengthGuardMaxTokens
		if maxTokens <= 0 {
			c.Next()
			return
		}
		// 压缩端点本身就是用来缩减上下文的，必须放行
		if strings.Contains(c.Request.URL.Path, "/responses/compact") {
			c.Next()
			return
		}
		if !strings.Contains(c.Request.Header.Get("Content-Type"), "application/json") {
			c.Next()
			return
		}

		storage, err := common.GetBodyStorage(c)
		if err != nil {
			// 请求体读取失败交给下游处理，这里不拦
			c.Next()
			return
		}
		userId := c.GetInt("id")

		// token 估算值不可能超过字节数，提前排除明显不超限的小请求
		if storage.Size() < int64(maxTokens) {
			contextGuardRecordRequest(userId, false)
			c.Next()
			return
		}

		body, err := storage.Bytes()
		if err != nil {
			c.Next()
			return
		}
		estimated := estimateRequestTokens(body)
		if estimated <= maxTokens {
			// body 大但实际不超限（base64/图片等被跳过的字段撑大的），
			// 视同正常请求：不计数、清零连续豁免额度
			contextGuardRecordRequest(userId, false)
			c.Next()
			return
		}

		// 真超限：活跃窗口内放行（受连续豁免上限约束），冷启动拦截
		limit := setting.ContextLengthGuardExemptLimit
		if contextGuardSessionActive(userId) {
			if limit > 0 && contextGuardExemptCount(userId) >= int64(limit) {
				// 豁免额度用尽，活跃会话中也拦；清零后进入宽限期，
				// 紧随其后的 /compact 压缩请求能放行
				contextGuardRecordRequest(userId, false)
				recordGuardDecision(c, userId, storage.Size(), model.GuardDecisionBlocked, estimated, maxTokens)
				abortContextTooLong(c, estimated, maxTokens)
				return
			}
			contextGuardRecordRequest(userId, true)
			loggerGuardAllow(c, userId, "session_active")
			recordGuardDecision(c, userId, storage.Size(), model.GuardDecisionAllowedActive, estimated, maxTokens)
			c.Next()
			return
		}

		// 拦截也要刷新活跃时间（进入宽限期），保证紧随其后的 /compact
		// 压缩请求能进窗口
		contextGuardRecordRequest(userId, false)
		recordGuardDecision(c, userId, storage.Size(), model.GuardDecisionBlocked, estimated, maxTokens)
		abortContextTooLong(c, estimated, maxTokens)
	}
}

// recordGuardDecision 异步记录守卫决策，只记超限相关事件（拦截/窗口豁免），
// 正常放行的请求不产生写入。
func recordGuardDecision(c *gin.Context, userId int, bodyBytes int64, decision, estimated, maxTokens int) {
	model.RecordGuardLog(model.GuardLog{
		UserId:          userId,
		Username:        c.GetString("username"),
		TokenName:       c.GetString("token_name"),
		Model:           c.GetString("original_model"),
		Endpoint:        c.Request.URL.Path,
		BodyBytes:       bodyBytes,
		EstimatedTokens: estimated,
		MaxTokens:       maxTokens,
		Decision:        decision,
	})
}

// contextGuardRecordRequest 刷新用户活跃时间；oversized 表示本次是超限请求，
// 非 oversize 的正常请求（含压缩成功后的第一轮）清零连续豁免计数。
func contextGuardRecordRequest(userId int, oversized bool) {
	if userId <= 0 {
		return
	}
	now := time.Now().Unix()
	newState := &contextGuardUserState{lastSeen: now}
	if _, loaded := contextGuardUsers.LoadOrStore(userId, newState); loaded {
		// 必须覆盖写入：对已存在的条目不更新时间，活跃窗口会永远停在
		// 第一个请求上，任务中途被拦、/compact 死循环都是它导致的
		updated := &contextGuardUserState{lastSeen: now}
		if oversized {
			updated.count = contextGuardExemptCount(userId) + 1
		}
		contextGuardUsers.Swap(userId, updated)
	}
	sweepContextGuardUsers()
}

func contextGuardExemptCount(userId int) int64 {
	v, ok := contextGuardUsers.Load(userId)
	if !ok {
		return 0
	}
	return v.(*contextGuardUserState).count
}

// contextGuardSessionActiveMaxEntries 触发惰性清理的条目数上限。
// 每条只有几十字节，正常站点远达不到；纯内部内存管理，不作为配置暴露。
const contextGuardSessionActiveMaxEntries = 100_000

func contextGuardSessionActive(userId int) bool {
	if userId <= 0 {
		return false
	}
	v, ok := contextGuardUsers.Load(userId)
	if !ok {
		return false
	}
	idleSeconds := contextGuardIdleSeconds()
	return time.Now().Unix()-v.(*contextGuardUserState).lastSeen < idleSeconds
}

func contextGuardIdleSeconds() int64 {
	idleSeconds := int64(setting.ContextLengthGuardIdleMinutes) * 60
	if idleSeconds <= 0 {
		idleSeconds = 600
	}
	return idleSeconds
}

// sweepContextGuardUsers 清理超过活跃窗口的过期条目，防止用户数增长导致
// 无界膨胀。只在条目数超过上限时整体扫一遍，正常情况下无开销。
func sweepContextGuardUsers() {
	now := time.Now().Unix()
	if atomic.LoadInt64(&contextGuardLastSeenCount) < contextGuardSessionActiveMaxEntries {
		return
	}
	// 全部条目都活跃时全表扫描无收益，一个窗口内最多扫一次
	if now-atomic.LoadInt64(&contextGuardLastSweepAt) < contextGuardIdleSeconds() {
		return
	}
	atomic.StoreInt64(&contextGuardLastSweepAt, now)
	expireBefore := now - contextGuardIdleSeconds()
	removed := int64(0)
	contextGuardUsers.Range(func(key, value any) bool {
		if value.(*contextGuardUserState).lastSeen < expireBefore {
			contextGuardUsers.Delete(key)
			removed++
		}
		return true
	})
	atomic.AddInt64(&contextGuardLastSeenCount, -removed)
}

var contextGuardLastSeenCount int64
var contextGuardLastSweepAt int64

// estimateRequestTokens 递归累加 JSON 里文本内容的 token 估算值。
// 键名、数字与字符串一样会进入模型上下文，一并计入；ASCII 约 3 字符/token
// （JSON/工具 schema 等结构化内容 tokenizer 效率低于自然语言的 4 字符/token，
// 按 4 估会明显低估），非 ASCII（中日韩等）约 1 字符/token。
// base64/图片/音频内容整体跳过：2MB 图片 base64 后按字节估算会虚算出数十万
// token，会误杀带图请求。
func estimateRequestTokens(body []byte) int {
	if !gjson.ValidBytes(body) {
		return 0
	}
	return countResultTokens(gjson.ParseBytes(body), "")
}

// contextGuardSkipKeys 只保留确定装二进制/编码数据的容器字段。普通文本字段
// （如 MCP 工具返回里的 data/url）不能按字段名跳过，会漏掉大量真实 token；
// base64 与数据 URI 由内容特征识别，与字段名无关。
var contextGuardSkipKeys = map[string]struct{}{
	"image_url":   {},
	"b64_json":    {},
	"input_audio": {},
	"inline_data": {},
	"file_data":   {},
	"source":      {},
	"image":       {},
}

func countResultTokens(r gjson.Result, key string) int {
	if _, skip := contextGuardSkipKeys[key]; skip {
		return 0
	}
	switch r.Type {
	case gjson.String:
		return stringTokens(r.String())
	case gjson.Number:
		return textTokens(r.Raw)
	case gjson.JSON:
		total := 0
		r.ForEach(func(k, v gjson.Result) bool {
			total += textTokens(k.String()) + countResultTokens(v, k.String())
			return true
		})
		return total
	}
	return 0
}

// stringTokens 估算单个字符串；数据 URI 与 base64 长串整体跳过。
func stringTokens(s string) int {
	if strings.HasPrefix(s, "data:") || isBase64Like(s) {
		return 0
	}
	return textTokens(s)
}

// isBase64Like 判断长字符串是否 base64 编码内容：无空格、几乎全由 base64
// 字符集构成、且含有数字（≥512 字符的真 base64 不含数字的概率可忽略；
// 纯字母重复文本如代码缩进、乱码长词不会误判）。
const base64MinLength = 512

func isBase64Like(s string) bool {
	if len(s) < base64MinLength {
		return false
	}
	matched := 0
	digits := 0
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'A' && c <= 'Z', c >= 'a' && c <= 'z', c >= '0' && c <= '9':
			matched++
			if c >= '0' && c <= '9' {
				digits++
			}
		case c == '+' || c == '/' || c == '=' || c == '-' || c == '_':
			matched++
		}
	}
	return digits > 0 && matched*100 >= len(s)*95
}

func textTokens(s string) int {
	ascii := 0
	nonAscii := 0
	for _, r := range s {
		if r < utf8.RuneSelf {
			ascii++
		} else {
			nonAscii++
		}
	}
	return (ascii+2)/3 + nonAscii
}

// abortContextTooLong 按请求协议返回错误：/v1/messages 用 Anthropic 错误结构
// （Claude Code 才能识别展示），其余路径用 OpenAI 错误结构。
// 文案优先用后台自定义的 ContextLengthGuardMessage（支持 {{.Tokens}}/{{.Max}}），
// 自定义为空或模板渲染失败时回退内置 i18n 文案。
func abortContextTooLong(c *gin.Context, estimated, maxTokens int) {
	data := map[string]any{
		"Tokens": estimated,
		"Max":    maxTokens,
	}
	message := renderContextGuardMessage(setting.ContextLengthGuardMessage, data)
	if message == "" {
		message = i18n.T(c, i18n.MsgContextGuardTooLong, data)
	}
	if strings.HasPrefix(c.Request.URL.Path, "/v1/messages") {
		c.JSON(http.StatusBadRequest, gin.H{
			"type": "error",
			"error": gin.H{
				"type":    "invalid_request_error",
				"message": message,
			},
		})
		c.Abort()
		return
	}
	abortWithOpenAiMessage(c, http.StatusBadRequest, message)
}

func renderContextGuardMessage(tpl string, data map[string]any) string {
	if strings.TrimSpace(tpl) == "" {
		return ""
	}
	parsed, err := template.New("context_guard").Parse(tpl)
	if err != nil {
		return ""
	}
	var sb strings.Builder
	if err := parsed.Execute(&sb, data); err != nil {
		return ""
	}
	return sb.String()
}

// loggerGuardAllow 记录活跃窗口放行的超长请求，便于观察窗口设置是否合理。
func loggerGuardAllow(c *gin.Context, userId int, reason string) {
	logger.LogInfo(c.Request.Context(), "context_guard: user "+strconv.Itoa(userId)+
		" oversized request allowed ("+reason+")")
}
