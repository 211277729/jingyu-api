package model

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// setupVisitTestDB 建立包含 visit_logs 与 users 表的临时库并替换全局 DB。
func setupVisitTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := "file:" + filepath.ToSlash(filepath.Join(t.TempDir(), "visit_log_test.db"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{},
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&VisitLog{}, &User{}))
	previousDB := DB
	DB = db
	// 重置节流缓冲，避免跨用例污染
	visitBuffer.Lock()
	visitBuffer.pending = nil
	visitBuffer.lastSeen = make(map[string]int64)
	visitBuffer.Unlock()
	t.Cleanup(func() {
		DB = previousDB
		_ = sqlDB.Close()
	})
	return db
}

func TestGetDailyVisitSummary(t *testing.T) {
	db := setupVisitTestDB(t)
	day := "2026-11-08"
	prevDay := "2026-11-07"
	dayStart, _ := VisitDayRange(day)
	require.NotZero(t, dayStart)

	// 老用户 bob：当天 3 次访问（含换 IP 前后两条，应仍按 user 聚合为一行）
	// 新用户 alice：当天注册、1 次访问 → is_new_user
	// 匿名 IP 1.1.1.1：2 次；匿名 IP 2.2.2.2：1 次
	require.NoError(t, db.Create(&User{Username: "bob", Password: "x", CreatedAt: dayStart - 86400, AffCode: "bobaff"}).Error)
	require.NoError(t, db.Create(&User{Username: "alice", Password: "x", CreatedAt: dayStart + 3600, AffCode: "aliceaff"}).Error)
	var bob, alice User
	require.NoError(t, db.Where("username = ?", "bob").First(&bob).Error)
	require.NoError(t, db.Where("username = ?", "alice").First(&alice).Error)

	records := []VisitLog{
		{Day: day, UserId: bob.Id, Username: "bob", Ip: "1.1.1.1", Path: "/", CreatedAt: dayStart + 100},
		{Day: day, UserId: bob.Id, Username: "bob", Ip: "1.1.1.1", Path: "/pricing", CreatedAt: dayStart + 200},
		{Day: day, UserId: bob.Id, Username: "bob", Ip: "3.3.3.3", Path: "/console", CreatedAt: dayStart + 300},
		{Day: day, UserId: alice.Id, Username: "alice", Ip: "1.1.1.1", Path: "/", CreatedAt: dayStart + 150},
		{Day: day, UserId: 0, Username: "", Ip: "1.1.1.1", Path: "/", CreatedAt: dayStart + 50},
		{Day: day, UserId: 0, Username: "", Ip: "1.1.1.1", Path: "/nav", CreatedAt: dayStart + 60},
		{Day: day, UserId: 0, Username: "", Ip: "2.2.2.2", Path: "/", CreatedAt: dayStart + 70},
		// 相邻日期的记录不应计入单日查询，但应计入跨日范围查询
		{Day: prevDay, UserId: bob.Id, Username: "bob", Ip: "1.1.1.1", Path: "/", CreatedAt: dayStart - 100},
	}
	require.NoError(t, db.Create(&records).Error)

	t.Run("single day", func(t *testing.T) {
		items, total, stats, err := GetDailyVisitSummary(day, day, 0, 100)
		require.NoError(t, err)

		assert.Equal(t, 4, total) // bob、alice、两个匿名 IP
		assert.Equal(t, VisitDailyStats{TotalVisitors: 4, LoggedIn: 2, Anonymous: 2, NewUsers: 1}, stats)

		byName := make(map[string]VisitSummaryItem)
		for _, item := range items {
			if item.UserId > 0 {
				byName[item.Username] = item
			} else {
				byName["anon:"+item.Ip] = item
			}
		}

		bobItem := byName["bob"]
		assert.Equal(t, int64(3), bobItem.VisitCount) // 换 IP 不拆行
		assert.False(t, bobItem.IsNewUser)
		assert.Equal(t, dayStart-86400, bobItem.UserCreatedAt)
		assert.Equal(t, int64(dayStart+100), bobItem.FirstVisitAt)
		assert.Equal(t, int64(dayStart+300), bobItem.LastVisitAt)

		aliceItem := byName["alice"]
		assert.Equal(t, int64(1), aliceItem.VisitCount)
		assert.True(t, aliceItem.IsNewUser)

		anon111 := byName["anon:1.1.1.1"]
		assert.Equal(t, int64(2), anon111.VisitCount)
		assert.True(t, anon111.IsAnonymous)

		// 分页：第 2 页只剩 1 条
		items2, total2, _, err := GetDailyVisitSummary(day, day, 3, 3)
		require.NoError(t, err)
		assert.Equal(t, 4, total2)
		assert.Len(t, items2, 1)
	})

	t.Run("date range", func(t *testing.T) {
		// 范围覆盖前一天：bob 多 1 次，总数不变（bob 仍一行）；
		// bob 注册时间恰在前一天 00:00（范围内），alice 在当天 → 两人都算范围内注册
		_, total, stats, err := GetDailyVisitSummary(prevDay, day, 0, 100)
		require.NoError(t, err)
		assert.Equal(t, 4, total)
		assert.Equal(t, 2, stats.NewUsers)

		// 反查只有前一天：bob 1 行 1 次
		items, total, _, err := GetDailyVisitSummary(prevDay, prevDay, 0, 100)
		require.NoError(t, err)
		assert.Equal(t, 1, total)
		assert.Equal(t, int64(1), items[0].VisitCount)
	})

	// 明细：bob 当天 3 条，按时间倒序；跨日范围 4 条
	details, detailTotal, err := GetDailyVisitDetail(day, day, bob.Id, "", 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(3), detailTotal)
	assert.Equal(t, int64(dayStart+300), details[0].CreatedAt)

	rangeDetails, rangeDetailTotal, err := GetDailyVisitDetail(prevDay, day, bob.Id, "", 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(4), rangeDetailTotal)
	assert.Len(t, rangeDetails, 4)

	// 匿名明细按 ip 过滤
	anonDetails, anonDetailTotal, err := GetDailyVisitDetail(day, day, 0, "1.1.1.1", 0, 10)
	require.NoError(t, err)
	assert.Equal(t, int64(2), anonDetailTotal)
	assert.Len(t, anonDetails, 2)
}

func TestVisitRecordThrottle(t *testing.T) {
	setupVisitTestDB(t)

	previousWindow := VisitDedupeWindow
	VisitDedupeWindow = 60 * time.Second
	t.Cleanup(func() { VisitDedupeWindow = previousWindow })

	// 同一访客 60s 内连续打点：只有第 1 次进入缓冲
	RecordVisit(1, "bob", "1.1.1.1", "/")
	RecordVisit(1, "bob", "1.1.1.1", "/pricing")
	RecordVisit(1, "bob", "1.1.1.1", "/keys")
	// 匿名同 IP 重复：只记 1 条；另一 IP 独立记录
	RecordVisit(0, "", "2.2.2.2", "/")
	RecordVisit(0, "", "2.2.2.2", "/nav")
	RecordVisit(0, "", "3.3.3.3", "/")
	// 超出窗口的重复访问允许再次记录
	visitBuffer.Lock()
	visitBuffer.lastSeen["u:1"] -= int64(VisitDedupeWindow/time.Second) + 1
	visitBuffer.Unlock()
	RecordVisit(1, "bob", "1.1.1.1", "/console")

	visitBuffer.Lock()
	pendingCount := len(visitBuffer.pending)
	visitBuffer.Unlock()
	assert.Equal(t, 4, pendingCount) // bob x2、2.2.2.2 x1、3.3.3.3 x1

	FlushVisitBuffer()
	var count int64
	require.NoError(t, DB.Model(&VisitLog{}).Count(&count).Error)
	assert.Equal(t, int64(4), count)

	// 冲刷后缓冲清空，节流键仍在窗口内 → 不再写入
	RecordVisit(0, "", "3.3.3.3", "/about")
	visitBuffer.Lock()
	assert.Len(t, visitBuffer.pending, 0)
	visitBuffer.Unlock()
}
