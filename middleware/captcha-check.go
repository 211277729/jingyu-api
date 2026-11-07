package middleware

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

// CaptchaCheck 按后台配置分派人机验证：
// provider=pow 走自研 PoW 工作量证明，否则回落到 Cloudflare Turnstile。
// 两种方式都复用 query 参数 turnstile 传 token，API 层无需区分。
func CaptchaCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		provider := system_setting.EffectiveCaptchaProvider(common.TurnstileCheckEnabled)
		switch provider {
		case "pow":
			powCheck(c)
			return
		case "turnstile":
			turnstileCheck(c)
			return
		}
		c.Next()
	}
}

// turnstileCheck 与原 middleware.TurnstileCheck 逻辑一致，仅改为内部函数，
// 由 CaptchaCheck 统一分派。
func turnstileCheck(c *gin.Context) {
	type turnstileCheckResponse struct {
		Success bool `json:"success"`
	}
	response := c.Query("turnstile")
	if response == "" {
		common.ApiErrorT(c, "Turnstile token is empty")
		c.Abort()
		return
	}
	rawRes, err := http.PostForm("https://challenges.cloudflare.com/turnstile/v0/siteverify", map[string][]string{
		"secret":   {common.TurnstileSecretKey},
		"response": {response},
		"remoteip": {c.ClientIP()},
	})
	if err != nil {
		common.SysLog(err.Error())
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		c.Abort()
		return
	}
	defer rawRes.Body.Close()
	var res turnstileCheckResponse
	err = common.DecodeJson(rawRes.Body, &res)
	if err != nil {
		common.SysLog(err.Error())
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		c.Abort()
		return
	}
	if !res.Success {
		common.ApiErrorT(c, "Turnstile verification failed, please refresh and try again!")
		c.Abort()
		return
	}
}

// --- PoW 工作量证明 ---

type powChallenge struct {
	Challenge  string `json:"challenge"`
	Difficulty int    `json:"difficulty"`
	IP         string `json:"ip"`
}

const powChallengeKeyPrefix = "pow:challenge:"

func randomHexToken() string {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return ""
	}
	return hex.EncodeToString(buf)
}

// powChallengeStore 未启用 Redis 时的内存兜底，懒清理过期挑战。
var powChallengeStore = struct {
	sync.Mutex
	items map[string]powChallengeEntry
}{items: make(map[string]powChallengeEntry)}

type powChallengeEntry struct {
	challenge powChallenge
	expiresAt time.Time
}

// IssuePoWChallenge 签发一个一次性 PoW 挑战。
func IssuePoWChallenge(clientIP string, difficulty int, ttl time.Duration) (id string, challenge string, err error) {
	id = randomHexToken()
	challenge = randomHexToken()
	if id == "" || challenge == "" {
		return "", "", errors.New("failed to generate PoW challenge")
	}
	record := powChallenge{
		Challenge:  challenge,
		Difficulty: difficulty,
		IP:         clientIP,
	}
	if common.RedisEnabled {
		data, err := json.Marshal(record)
		if err != nil {
			return "", "", err
		}
		if err := common.RedisSet(powChallengeKeyPrefix+id, string(data), ttl); err != nil {
			return "", "", err
		}
		return id, challenge, nil
	}
	powChallengeStore.Lock()
	powChallengeStore.items[id] = powChallengeEntry{challenge: record, expiresAt: time.Now().Add(ttl)}
	powChallengeStore.Unlock()
	return id, challenge, nil
}

// ConsumePoWChallenge 原子取出并删除挑战（一次性），不存在或已过期返回 false。
func ConsumePoWChallenge(id string) (powChallenge, bool) {
	if common.RedisEnabled {
		raw, err := common.RDB.GetDel(context.Background(), powChallengeKeyPrefix+id).Result()
		if err != nil {
			return powChallenge{}, false
		}
		var record powChallenge
		if err := json.Unmarshal([]byte(raw), &record); err != nil {
			return powChallenge{}, false
		}
		return record, true
	}
	powChallengeStore.Lock()
	defer powChallengeStore.Unlock()
	now := time.Now()
	for key, entry := range powChallengeStore.items {
		if entry.expiresAt.Before(now) {
			delete(powChallengeStore.items, key)
		}
	}
	entry, ok := powChallengeStore.items[id]
	if !ok {
		return powChallenge{}, false
	}
	delete(powChallengeStore.items, id)
	return entry.challenge, true
}

// countLeadingZeroBits 统计摘要的前导零 bit 数。
func countLeadingZeroBits(digest [sha256.Size]byte) int {
	zero := 0
	for _, b := range digest {
		if b == 0 {
			zero += 8
			continue
		}
		for b&0x80 == 0 {
			zero++
			b <<= 1
		}
		break
	}
	return zero
}

// verifyPoWSolution 校验 sha256(challenge:nonce) 前导零是否达标。
func verifyPoWSolution(challenge string, nonce string, difficulty int) bool {
	digest := sha256.Sum256([]byte(challenge + ":" + nonce))
	return countLeadingZeroBits(digest) >= difficulty
}

func powCheck(c *gin.Context) {
	provider := system_setting.GetCaptchaSettings()
	token := c.Query("turnstile")
	if token == "" {
		common.ApiErrorT(c, "Captcha token is empty")
		c.Abort()
		return
	}
	id, nonce, ok := strings.Cut(token, ".")
	if !ok || id == "" || nonce == "" || strings.Contains(id, ":") {
		common.ApiErrorT(c, "Captcha verification failed, please try again!")
		c.Abort()
		return
	}
	record, ok := ConsumePoWChallenge(id)
	if !ok {
		common.ApiErrorT(c, "Captcha challenge expired, please try again!")
		c.Abort()
		return
	}
	if subtle.ConstantTimeCompare([]byte(record.IP), []byte(c.ClientIP())) != 1 {
		common.ApiErrorT(c, "Captcha verification failed, please try again!")
		c.Abort()
		return
	}
	if !verifyPoWSolution(record.Challenge, nonce, provider.ClampedPowDifficulty()) {
		common.ApiErrorT(c, "Captcha verification failed, please try again!")
		c.Abort()
		return
	}
	c.Next()
}

// RegisterRateLimit 注册接口专用频控：按 IP + 全站总量双桶。
// 配置每次请求读取，后台改动即时生效；未启用 Redis 时内存滑动窗口
// 的保留期受 common.RateLimitKeyExpirationDuration（20 分钟）约束。
func RegisterRateLimit() func(c *gin.Context) {
	return func(c *gin.Context) {
		setting := system_setting.GetRegisterLimitSettings()
		if !setting.Enabled {
			c.Next()
			return
		}
		if setting.IPNum >= 1 {
			if !takeRegisterRateLimit(c, "REG:I", setting.IPNum, setting.IPWindow()) {
				return
			}
		}
		if setting.GlobalNum >= 1 {
			// 全站桶不区分 IP，所有请求共享同一个 key。
			if !takeRegisterRateLimitKeyed(c, "REG:G", "all", setting.GlobalNum, setting.GlobalWindow()) {
				return
			}
		}
		c.Next()
	}
}

func takeRegisterRateLimit(c *gin.Context, mark string, num int, duration int64) bool {
	return takeRegisterRateLimitKeyed(c, mark, c.ClientIP(), num, duration)
}

func takeRegisterRateLimitKeyed(c *gin.Context, mark string, identity string, num int, duration int64) bool {
	if common.RedisEnabled {
		allowed, _, ttlSeconds, err := redisFixedWindowTake(
			c.Request.Context(),
			redisIPRateLimitKey(mark, identity),
			num,
			duration,
		)
		if err != nil {
			logger.LogError(c.Request.Context(), common.LogText("register rate limit check failed (mark=%s): %v", mark, err))
			c.Status(http.StatusInternalServerError)
			c.Abort()
			return false
		}
		if !allowed {
			writeRateLimited(c, ttlSeconds)
			return false
		}
		return true
	}
	inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)
	key := mark + ":" + identity
	if !inMemoryRateLimiter.Request(key, num, duration) {
		writeRateLimited(c, duration)
		return false
	}
	return true
}
