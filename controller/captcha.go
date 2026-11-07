package controller

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

// GetPoWChallenge 签发一个一次性 PoW 挑战。
// 前端在 Web Worker 里穷举 nonce，使 sha256(challenge:nonce) 的
// 前导零位数达到 pow_difficulty，再把 challenge_id.nonce 作为
// turnstile query 参数随业务请求提交，由 middleware.CaptchaCheck 校验。
func GetPoWChallenge(c *gin.Context) {
	setting := system_setting.GetCaptchaSettings()
	id, challenge, err := middleware.IssuePoWChallenge(
		c.ClientIP(),
		setting.ClampedPowDifficulty(),
		time.Duration(setting.ClampedChallengeTTL())*time.Second,
	)
	if err != nil {
		common.SysError("failed to issue PoW challenge: " + err.Error())
		common.ApiErrorT(c, "Failed to issue captcha challenge, please try again!")
		return
	}
	common.ApiSuccess(c, gin.H{
		"challenge_id": id,
		"challenge":    challenge,
		"difficulty":   setting.ClampedPowDifficulty(),
		"expires_in":   setting.ClampedChallengeTTL(),
	})
}
