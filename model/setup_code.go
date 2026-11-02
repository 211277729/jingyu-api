package model

import (
	"crypto/rand"
	"errors"
	"math/big"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const (
	// SetupCodeTTL 是配置码的有效期；到期未兑换即作废。
	SetupCodeTTL = 10 * time.Minute
	// SetupCodeLength 是明文配置码的长度；兑换接口匿名可调，
	// 高熵短码 + HMAC 存储 + 限流共同承担防爆破职责。
	SetupCodeLength = 16
	// setupCodeAlphabet 去掉了易混淆的 I/L/O/0/1。
	setupCodeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
)

var (
	ErrSetupCodeInvalid = errors.New("setup code is invalid")
	ErrSetupCodeExpired = errors.New("setup code has expired")
)

// SetupCode 是「AI 代理配置」的一次性短码：用户在文档页生成短码交给 AI agent，
// agent 匿名兑换后由服务端代为创建一把新令牌。CodeHash 是短码的 HMAC，
// 明文码本身不落库。
type SetupCode struct {
	Id          int64     `json:"id" gorm:"primaryKey"`
	UserId      int       `json:"user_id" gorm:"index"`
	CodeHash    string    `json:"-" gorm:"type:char(64);not null;uniqueIndex"`
	CreatedTime time.Time `json:"created_time"`
	ExpiresAt   time.Time `json:"expires_at" gorm:"not null;index"`
}

func (SetupCode) TableName() string {
	return "setup_codes"
}

func setupCodeHash(code string) string {
	return common.GenerateHMACWithKey([]byte("setup-code-v1:"+common.SessionSecret), code)
}

// normalizeSetupCode 容忍复制粘贴带入的空格、横线与大小写差异。
func normalizeSetupCode(code string) string {
	replacer := strings.NewReplacer(" ", "", "-", "", "_", "")
	return strings.ToUpper(replacer.Replace(strings.TrimSpace(code)))
}

// CreateSetupCode 为用户生成一个新的明文配置码；同一用户只保留一个有效码，
// 生成时会先删掉旧码与全部过期码。
func CreateSetupCode(userId int) (string, error) {
	now := time.Now()
	codeBytes := make([]byte, SetupCodeLength)
	max := big.NewInt(int64(len(setupCodeAlphabet)))
	for i := range codeBytes {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		codeBytes[i] = setupCodeAlphabet[n.Int64()]
	}
	code := string(codeBytes)

	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ?", userId).Delete(&SetupCode{}).Error; err != nil {
			return err
		}
		if err := tx.Where("expires_at < ?", now).Delete(&SetupCode{}).Error; err != nil {
			return err
		}
		return tx.Create(&SetupCode{
			UserId:      userId,
			CodeHash:    setupCodeHash(code),
			CreatedTime: now,
			ExpiresAt:   now.Add(SetupCodeTTL),
		}).Error
	})
	if err != nil {
		return "", err
	}
	return code, nil
}

// ConsumeSetupCode 单次有效地消费一个配置码并返回其属主用户 id。
// 认领动作是带过期条件的删除：并发兑换只有一个事务能删到该行，
// 其余得到 invalid。
func ConsumeSetupCode(code string) (int, error) {
	code = normalizeSetupCode(code)
	if len(code) != SetupCodeLength {
		return 0, ErrSetupCodeInvalid
	}
	var userId int
	err := DB.Transaction(func(tx *gorm.DB) error {
		var row SetupCode
		err := tx.Where("code_hash = ?", setupCodeHash(code)).First(&row).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrSetupCodeInvalid
			}
			return err
		}
		now := time.Now()
		if !row.ExpiresAt.After(now) {
			return ErrSetupCodeExpired
		}
		result := tx.Where("id = ? AND expires_at > ?", row.Id, now).Delete(&SetupCode{})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return ErrSetupCodeInvalid
		}
		userId = row.UserId
		return nil
	})
	if err != nil {
		return 0, err
	}
	return userId, nil
}
