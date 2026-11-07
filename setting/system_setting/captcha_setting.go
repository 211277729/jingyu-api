package system_setting

import "github.com/QuantumNous/new-api/setting/config"

// CaptchaSetting 人机验证方式配置。
// Turnstile 的站点密钥仍走旧的 TurnstileSiteKey / TurnstileSecretKey 平铺 option，
// 这里只负责选择验证方式与 PoW 参数。
type CaptchaSetting struct {
	Provider        string `json:"provider"`          // turnstile | pow
	PowDifficulty   int    `json:"pow_difficulty"`    // sha256 前导零 bit 数
	PowChallengeTTL int    `json:"pow_challenge_ttl"` // 挑战有效期（秒）
}

// 默认配置
var captchaSetting = CaptchaSetting{
	Provider:        "turnstile",
	PowDifficulty:   20,
	PowChallengeTTL: 120,
}

func init() {
	config.GlobalConfig.Register("captcha_setting", &captchaSetting)
}

// GetCaptchaSettings 获取人机验证配置
func GetCaptchaSettings() *CaptchaSetting {
	return &captchaSetting
}

// EffectiveCaptchaProvider 当前生效的验证方式：none | turnstile | pow。
// Turnstile 还需旧开关 TurnstileCheckEnabled 打开才算启用。
func EffectiveCaptchaProvider(turnstileEnabled bool) string {
	switch captchaSetting.Provider {
	case "pow":
		return "pow"
	case "turnstile":
		if turnstileEnabled {
			return "turnstile"
		}
	}
	return "none"
}

// PowDifficulty clamped to a sane range: below 12 barely costs anything,
// above 26 makes low-end mobile clients take minutes.
func (s *CaptchaSetting) ClampedPowDifficulty() int {
	if s.PowDifficulty < 12 {
		return 12
	}
	if s.PowDifficulty > 26 {
		return 26
	}
	return s.PowDifficulty
}

func (s *CaptchaSetting) ClampedChallengeTTL() int {
	if s.PowChallengeTTL < 30 {
		return 30
	}
	if s.PowChallengeTTL > 600 {
		return 600
	}
	return s.PowChallengeTTL
}
