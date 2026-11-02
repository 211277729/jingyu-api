package controller

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

const setupCodeAgentTokenName = "AI Agent"

type setupCodeRequest struct {
	Code string `json:"code"`
}

// GenerateSetupCode 为当前登录用户生成一个一次性配置码，用于把
// 「配置 AI 网关」这件事交给本机 AI agent 完成。
func GenerateSetupCode(c *gin.Context) {
	userId := c.GetInt("id")
	// 令牌在兑换时才创建，这里先按同样的上限预检，避免用户拿到
	// 一个注定兑换失败的码。
	maxTokens := operation_setting.GetMaxUserTokens()
	count, err := model.CountUserTokens(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if int(count) >= maxTokens {
		common.ApiErrorT(c, "Maximum number of tokens reached ({{max}})", map[string]any{"max": maxTokens})
		return
	}
	code, err := model.CreateSetupCode(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"code":       code,
		"expires_in": int(model.SetupCodeTTL.Seconds()),
	})
}

// RedeemSetupCode 是匿名端点：AI agent 用配置码换取一把新令牌。
// 配置码哈希存储、单次有效、短时效，兑换成功即建新 token 并返回完整 sk- key。
func RedeemSetupCode(c *gin.Context) {
	var request setupCodeRequest
	if err := c.ShouldBindJSON(&request); err != nil || strings.TrimSpace(request.Code) == "" {
		common.ApiErrorT(c, "Setup code is required")
		return
	}
	userId, err := model.ConsumeSetupCode(request.Code)
	if err != nil {
		if errors.Is(err, model.ErrSetupCodeExpired) {
			common.ApiErrorT(c, "Setup code has expired, generate a new one")
			return
		}
		common.ApiErrorT(c, "Invalid setup code")
		return
	}
	key, err := common.GenerateKey()
	if err != nil {
		common.SysError(common.LogText("failed to generate token key for setup code: %s", err.Error()))
		common.ApiErrorT(c, "Failed to generate token")
		return
	}
	token := model.Token{
		UserId:         userId,
		Name:           setupCodeAgentTokenName,
		Key:            key,
		CreatedTime:    common.GetTimestamp(),
		AccessedTime:   common.GetTimestamp(),
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}
	token.AllowUserQuotaQuery = true
	if err := token.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"key": "sk-" + key,
	})
}
