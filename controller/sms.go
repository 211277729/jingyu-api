package controller

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/sms"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

type phoneVerificationRequest struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
}

// SendPhoneVerification 向手机号发送登录/注册验证码（未登录接口）。
func SendPhoneVerification(c *gin.Context) {
	if !system_setting.IsPhoneLoginEnabled() {
		common.ApiErrorT(c, "Phone number login has been disabled by administrator")
		return
	}
	phone, err := sms.NormalizePhone(c.Query("phone"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	code, err := sms.GenerateNumericCode(sms.PhoneCodeLength)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.RegisterVerificationCodeWithKey(phone, code, sms.PhoneLoginPurpose)
	if err := sms.SendVerificationCode(phone, code); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

type PhoneLoginRequest struct {
	Phone   string `json:"phone"`
	Code    string `json:"code"`
	AffCode string `json:"aff_code"`
}

// PhoneLogin 手机号验证码登录：有账号直接登录，没有账号则自动注册。
func PhoneLogin(c *gin.Context) {
	if !system_setting.IsPhoneLoginEnabled() {
		common.ApiErrorT(c, "Phone number login has been disabled by administrator")
		return
	}
	var req PhoneLoginRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	phone, err := sms.NormalizePhone(req.Phone)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	req.Code = strings.TrimSpace(req.Code)
	if req.Code == "" {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	if !common.VerifyCodeWithKey(phone, req.Code, sms.PhoneLoginPurpose) {
		common.ApiErrorT(c, "Verification code is incorrect or has expired")
		return
	}

	user, err := model.GetUserByPhone(phone)
	if err != nil {
		common.SysLog(common.LogText("PhoneLogin query user by phone error: %v", err))
		common.ApiErrorT(c, "Database error, please contact the administrator")
		return
	}
	if user == nil {
		user, err = registerUserByPhone(phone, req.AffCode)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}

	common.DeleteKey(phone, sms.PhoneLoginPurpose)
	c.Set("login_method", "phone")
	setupLogin(user, nil, c)
}

// registerUserByPhone 用手机号自动注册新账号。
func registerUserByPhone(phone string, affCode string) (*model.User, error) {
	if !common.RegisterEnabled {
		return nil, errors.New("New user registration has been disabled by administrator")
	}
	if err := model.EnsurePhoneAvailable(phone, 0); err != nil {
		return nil, err
	}

	username := "phone" + strconv.Itoa(model.GetMaxUserId()+1)
	if len(username) > model.UserNameMaxLength {
		username = username[:model.UserNameMaxLength]
	}
	// 随机密码：手机号验证码即为登录凭证，用户可在设置中自行修改密码
	password := common.GenerateVerificationCode(12)
	cleanUser := model.User{
		Username:    username,
		Password:    password,
		DisplayName: sms.MaskPhone(phone),
		Phone:       phone,
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
	}
	inviterId := 0
	if affCode != "" {
		inviterId, _ = model.GetUserIdByAffCode(affCode)
	}
	if err := cleanUser.Insert(inviterId); err != nil {
		if errors.Is(err, model.ErrEmailAlreadyTaken) {
			// Insert 内部会校验邮箱，手机号注册不带邮箱，正常不会走到这里
			return nil, model.ErrPhoneAlreadyTaken
		}
		return nil, err
	}

	// 与 Register 保持一致：为新用户生成默认令牌
	var insertedUser model.User
	if err := model.DB.Where("username = ?", cleanUser.Username).First(&insertedUser).Error; err != nil {
		return nil, err
	}
	if constant.GenerateDefaultToken {
		key, err := common.GenerateKey()
		if err != nil {
			common.SysLog(common.LogText("failed to generate token key: %s", err.Error()))
			return &insertedUser, nil
		}
		token := model.Token{
			UserId:             insertedUser.Id,
			Name:               cleanUser.Username,
			Key:                key,
			CreatedTime:        common.GetTimestamp(),
			AccessedTime:       common.GetTimestamp(),
			ExpiredTime:        -1,
			RemainQuota:        500000,
			UnlimitedQuota:     true,
			ModelLimitsEnabled: false,
		}
		token.AllowUserQuotaQuery = true
		if setting.DefaultUseAutoGroup {
			token.Group = "auto"
		}
		if err := token.Insert(); err != nil {
			common.SysLog(common.LogText("failed to create default token for phone user %s: %s", cleanUser.Username, err.Error()))
		}
	}
	return &insertedUser, nil
}

// SendPhoneBindVerification 向当前登录用户要绑定的手机号发送验证码。
func SendPhoneBindVerification(c *gin.Context) {
	if !system_setting.IsPhoneLoginEnabled() {
		common.ApiErrorT(c, "Phone number login has been disabled by administrator")
		return
	}
	userId := c.GetInt("id")
	phone, err := sms.NormalizePhone(c.Query("phone"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.EnsurePhoneAvailable(phone, userId); err != nil {
		common.ApiError(c, err)
		return
	}
	code, err := sms.GenerateNumericCode(sms.PhoneCodeLength)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.RegisterVerificationCodeWithKey(phone, code, sms.PhoneBindPurpose)
	if err := sms.SendVerificationCode(phone, code); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// PhoneBind 已登录用户绑定手机号（绑定后即可用手机号验证码登录）。
func PhoneBind(c *gin.Context) {
	if !system_setting.IsPhoneLoginEnabled() {
		common.ApiErrorT(c, "Phone number login has been disabled by administrator")
		return
	}
	userId := c.GetInt("id")
	var req phoneVerificationRequest
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	phone, err := sms.NormalizePhone(req.Phone)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !common.VerifyCodeWithKey(phone, strings.TrimSpace(req.Code), sms.PhoneBindPurpose) {
		common.ApiErrorT(c, "Verification code is incorrect or has expired")
		return
	}
	if err := model.BindUserPhone(userId, phone); err != nil {
		common.ApiError(c, err)
		return
	}
	common.DeleteKey(phone, sms.PhoneBindPurpose)
	common.ApiSuccessT(c, "Phone number bound successfully", nil)
}
