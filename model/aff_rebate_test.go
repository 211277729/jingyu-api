package model

import (
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// setupAffRebateTestDB 建立包含用户/充值/卡密/日志表的内存库。
func setupAffRebateTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	// 用临时文件而非 :memory:：RecordLog 会在事务外再开连接，:memory: 每个连接独立会导致查不到表
	dsn := "file:" + filepath.ToSlash(filepath.Join(t.TempDir(), "aff_rebate_test.db"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{},
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &TopUp{}, &Redemption{}, &Log{}))
	previousDB, previousLogDB := DB, LOG_DB
	DB, LOG_DB = db, db
	t.Cleanup(func() {
		DB, LOG_DB = previousDB, previousLogDB
		_ = sqlDB.Close()
	})
	return db
}

// markTopupSuccess 模拟支付回调先把订单置为成功再入账的真实顺序，
// applyAffTopupRebate 依赖订单行已落库来判定首笔。
func markTopupSuccess(t *testing.T, db *gorm.DB, userId int, quota int) {
	t.Helper()
	require.NoError(t, db.Create(&TopUp{
		UserId:       userId,
		Amount:       int64(quota / int(common.QuotaPerUnit)),
		Status:       common.TopUpStatusSuccess,
		TradeNo:      fmt.Sprintf("trade-%d-%d", userId, time.Now().UnixNano()),
		CompleteTime: common.GetTimestamp(),
	}).Error)
}

// withAffRebateSetting 临时改写返利配置并确认合规条款，测试结束后还原。
func withAffRebateSetting(t *testing.T, firstPercent, percent float64, firstDays int) {
	t.Helper()
	previous := *operation_setting.GetAffRebateSetting()
	operation_setting.GetAffRebateSetting().FirstPercent = firstPercent
	operation_setting.GetAffRebateSetting().Percent = percent
	operation_setting.GetAffRebateSetting().FirstDays = firstDays
	payment := operation_setting.GetPaymentSetting()
	previousConfirmed, previousVersion := payment.ComplianceConfirmed, payment.ComplianceTermsVersion
	payment.ComplianceConfirmed, payment.ComplianceTermsVersion = true, operation_setting.CurrentComplianceTermsVersion
	t.Cleanup(func() {
		*operation_setting.GetAffRebateSetting() = previous
		payment.ComplianceConfirmed, payment.ComplianceTermsVersion = previousConfirmed, previousVersion
	})
}

func createAffRebateUser(t *testing.T, db *gorm.DB, username string, inviterId int, createdAt int64) *User {
	t.Helper()
	user := &User{
		Username:    username,
		AffCode:     username,
		InviterId:   inviterId,
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		AuthVersion: 1,
	}
	require.NoError(t, db.Create(user).Error)
	if createdAt != 0 {
		require.NoError(t, db.Model(&User{}).Where("id = ?", user.Id).Update("created_at", createdAt).Error)
	}
	return user
}

func getAffQuota(t *testing.T, db *gorm.DB, userId int) (int, int) {
	t.Helper()
	var affQuota, affHistory int
	require.NoError(t, db.Model(&User{}).Where("id = ?", userId).
		Select("aff_quota", "aff_history").Row().Scan(&affQuota, &affHistory))
	return affQuota, affHistory
}

// TestApplyAffTopupRebate_FirstAndRecurring 验证首笔按首充比例、后续按常规比例返利。
func TestApplyAffTopupRebate_FirstAndRecurring(t *testing.T) {
	withAffRebateSetting(t, 20, 5, 0)
	db := setupAffRebateTestDB(t)
	inviter := createAffRebateUser(t, db, "rebinviter", 0, 0)
	invitee := createAffRebateUser(t, db, "rebinvitee", inviter.Id, 0)

	// 首笔入账 $1（500000 quota），按 20% 返 100000
	markTopupSuccess(t, db, invitee.Id, 500000)
	err := DB.Transaction(func(tx *gorm.DB) error {
		return creditTopUpQuota(tx, invitee.Id, 500000, nil)
	})
	require.NoError(t, err)
	affQuota, affHistory := getAffQuota(t, db, inviter.Id)
	assert.Equal(t, 100000, affQuota)
	assert.Equal(t, 100000, affHistory)

	// 第二笔按 5% 返 25000
	markTopupSuccess(t, db, invitee.Id, 500000)
	err = DB.Transaction(func(tx *gorm.DB) error {
		return creditTopUpQuota(tx, invitee.Id, 500000, nil)
	})
	require.NoError(t, err)
	affQuota, affHistory = getAffQuota(t, db, inviter.Id)
	assert.Equal(t, 125000, affQuota)
	assert.Equal(t, 125000, affHistory)

}

// TestApplyAffTopupRebate_FirstDaysWindow 验证首充限时窗口：注册超期后首笔也按常规比例。
func TestApplyAffTopupRebate_FirstDaysWindow(t *testing.T) {
	withAffRebateSetting(t, 20, 5, 30)
	db := setupAffRebateTestDB(t)
	inviter := createAffRebateUser(t, db, "rebinviter2", 0, 0)
	// 注册于 100 天前，超出 30 天窗口
	invitee := createAffRebateUser(t, db, "rebinvitee2", inviter.Id, common.GetTimestamp()-100*86400)

	err := DB.Transaction(func(tx *gorm.DB) error {
		return creditTopUpQuota(tx, invitee.Id, 500000, nil)
	})
	require.NoError(t, err)
	affQuota, _ := getAffQuota(t, db, inviter.Id)
	assert.Equal(t, 25000, affQuota)
}

// TestApplyAffTopupRebate_DisabledAndMissingInviter 验证比例关闭与无邀请人时不返利、不报错。
func TestApplyAffTopupRebate_DisabledAndMissingInviter(t *testing.T) {
	withAffRebateSetting(t, 0, 0, 0)
	db := setupAffRebateTestDB(t)
	loner := createAffRebateUser(t, db, "rebloner", 0, 0)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return creditTopUpQuota(tx, loner.Id, 500000, nil)
	}))
	var affQuota int
	require.NoError(t, db.Model(&User{}).Where("id = ?", loner.Id).
		Select("aff_quota").Row().Scan(&affQuota))
	assert.Equal(t, 0, affQuota)

	// 打开比例后，无邀请人的用户充值仍正常入账（首笔 500000 + 第二笔 500000）
	withAffRebateSetting(t, 20, 5, 0)
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return creditTopUpQuota(tx, loner.Id, 500000, nil)
	}))
	var quota int
	require.NoError(t, db.Model(&User{}).Where("id = ?", loner.Id).
		Select("quota").Row().Scan(&quota))
	assert.Equal(t, 1000000, quota)
}

// TestApplyAffTopupRebate_ComplianceGate 验证未确认合规条款时不发放返利。
func TestApplyAffTopupRebate_ComplianceGate(t *testing.T) {
	withAffRebateSetting(t, 20, 5, 0)
	payment := operation_setting.GetPaymentSetting()
	previousConfirmed, previousVersion := payment.ComplianceConfirmed, payment.ComplianceTermsVersion
	payment.ComplianceConfirmed, payment.ComplianceTermsVersion = false, ""
	t.Cleanup(func() {
		payment.ComplianceConfirmed, payment.ComplianceTermsVersion = previousConfirmed, previousVersion
	})

	db := setupAffRebateTestDB(t)
	inviter := createAffRebateUser(t, db, "rebinviter3", 0, 0)
	invitee := createAffRebateUser(t, db, "rebinvitee3", inviter.Id, 0)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return creditTopUpQuota(tx, invitee.Id, 500000, nil)
	}))
	affQuota, _ := getAffQuota(t, db, inviter.Id)
	assert.Equal(t, 0, affQuota)
}
