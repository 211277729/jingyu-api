package sms

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// 验证码用途，存入 common 的验证码表（purpose+phone 作为键）。
const (
	PhoneLoginPurpose = "p" // 手机号验证码登录/注册
	PhoneBindPurpose  = "b" // 已登录用户绑定手机号
)

// PhoneCodeLength 短信验证码位数（纯数字）。
const PhoneCodeLength = 4

var phonePattern = regexp.MustCompile(`^1[3-9]\d{9}$`)

// GenerateNumericCode 生成 n 位纯数字验证码（crypto/rand，允许前导零）。
func GenerateNumericCode(length int) (string, error) {
	max := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(length)), nil)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%0*d", length, n.Int64()), nil
}

// NormalizePhone 归一化手机号：去掉 +86 / 86 前缀并校验，
// 返回带 +86 的 E.164 格式；仅支持中国大陆手机号。
func NormalizePhone(phone string) (string, error) {
	phone = strings.TrimSpace(phone)
	phone = strings.TrimPrefix(phone, "+86")
	phone = strings.TrimPrefix(phone, "86")
	if !phonePattern.MatchString(phone) {
		return "", errors.New("Invalid phone number")
	}
	return "+86" + phone, nil
}

// MaskPhone 手机号脱敏，用于展示。
func MaskPhone(e164 string) string {
	digits := strings.TrimPrefix(e164, "+86")
	if len(digits) != 11 {
		return e164
	}
	return digits[:3] + "****" + digits[7:]
}

// Sender 短信服务商抽象。
type Sender interface {
	Send(phone string, code string) error
}

// GetSender 根据管理端配置返回短信发送器。
func GetSender() (Sender, error) {
	s := system_setting.GetSmsSettings()
	if !s.Enabled {
		return nil, errors.New("Phone number login has been disabled by administrator")
	}
	switch strings.ToLower(strings.TrimSpace(s.Provider)) {
	case "aliyun":
		if s.AliyunAccessKeyId == "" || s.AliyunAccessSecret == "" ||
			s.AliyunSignName == "" || s.AliyunTemplateCode == "" {
			return nil, errors.New("SMS provider configuration is incomplete, please complete it in system settings")
		}
		return &AliyunSender{
			AccessKeyId:  s.AliyunAccessKeyId,
			AccessSecret: s.AliyunAccessSecret,
			SignName:     s.AliyunSignName,
			TemplateCode: s.AliyunTemplateCode,
		}, nil
	case "tencent":
		region := strings.TrimSpace(s.TencentRegion)
		if region == "" {
			region = "ap-guangzhou"
		}
		if s.TencentSecretId == "" || s.TencentSecret == "" ||
			s.TencentSdkAppId == "" || s.TencentSignName == "" || s.TencentTemplateId == "" {
			return nil, errors.New("SMS provider configuration is incomplete, please complete it in system settings")
		}
		return &TencentSender{
			SecretId:   s.TencentSecretId,
			SecretKey:  s.TencentSecret,
			SdkAppId:   s.TencentSdkAppId,
			SignName:   s.TencentSignName,
			TemplateId: s.TencentTemplateId,
			Region:     region,
		}, nil
	case "debug":
		// 本地调试：不发送真实短信，验证码写入运行日志，用于短信资质下来前走通流程
		return &DebugSender{}, nil
	default:
		return nil, fmt.Errorf("Unknown SMS provider: %s", s.Provider)
	}
}

// SendVerificationCode 校验手机号并发送验证码。
func SendVerificationCode(phone string, code string) error {
	sender, err := GetSender()
	if err != nil {
		return err
	}
	if err := sender.Send(phone, code); err != nil {
		common.SysLog(common.LogText("failed to send sms to %s: %s", MaskPhone(phone), err.Error()))
		return errors.New("Failed to send SMS, please try again later")
	}
	return nil
}
