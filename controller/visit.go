package controller

import (
	"errors"
	"regexp"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

var visitDayPattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

const (
	visitPathMaxLen   = 255
	// visitRangeMaxDays 查询范围上限，防止被恶意拉超长范围拖垮数据库。
	visitRangeMaxDays = 92
)

type trackVisitRequest struct {
	Path string `json:"path"`
}

// TrackVisit 前端页面导航打点：TryUserAuth 已在路由上做过可选认证，
// 已登录取上下文身份，未登录匿名（UserId=0，按 IP 归属）。
// 记录先进内存节流缓冲再批量落库，失败静默，不影响访客。
func TrackVisit(c *gin.Context) {
	userId := c.GetInt("id")
	username := ""
	if userId > 0 {
		username = c.GetString("username")
	}

	var req trackVisitRequest
	_ = c.ShouldBindJSON(&req)
	path := strings.TrimSpace(req.Path)
	if path == "" {
		path = "/"
	}
	path = strings.Split(path, "\n")[0]
	if len(path) > visitPathMaxLen {
		runes := []rune(path)
		for i := len(runes); i > 0; i-- {
			if len(string(runes[:i])) <= visitPathMaxLen {
				path = string(runes[:i])
				break
			}
		}
	}

	model.RecordVisit(userId, username, c.ClientIP(), path)
	common.ApiSuccess(c, nil)
}

// parseVisitRange 解析查询范围：支持 date（单日）或 start_date/end_date（闭区间），
// 都缺省时为当天；end < start 时报错，跨度超过 visitRangeMaxDays 报错。
func parseVisitRange(c *gin.Context) (string, string, error) {
	today := model.CurrentVisitDay()
	start := strings.TrimSpace(c.Query("start_date"))
	end := strings.TrimSpace(c.Query("end_date"))
	if start == "" && end == "" {
		if day := strings.TrimSpace(c.Query("date")); day != "" {
			start, end = day, day
		}
	}
	if start == "" {
		start = today
	}
	if end == "" {
		end = today
	}
	if !visitDayPattern.MatchString(start) || !visitDayPattern.MatchString(end) {
		return "", "", errors.New("invalid date, expected YYYY-MM-DD")
	}
	if end < start {
		return "", "", errors.New("end_date must not be earlier than start_date")
	}
	rangeStart, _ := model.VisitDayRange(start)
	_, rangeEnd := model.VisitDayRange(end)
	if rangeEnd-rangeStart > int64(visitRangeMaxDays)*86400 {
		return "", "", errors.New("date range too long, max 92 days")
	}
	return start, end, nil
}

// GetDailyVisits 管理员查询日期范围内的访客汇总（含构成统计）。
// 默认当天 00:00:00–23:59:59（东八区）。
func GetDailyVisits(c *gin.Context) {
	startDay, endDay, err := parseVisitRange(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo := common.GetPageQuery(c)
	items, total, stats, err := model.GetDailyVisitSummary(startDay, endDay, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"page":       pageInfo.GetPage(),
		"page_size":  pageInfo.GetPageSize(),
		"total":      total,
		"items":      items,
		"stats":      stats,
		"start_date": startDay,
		"end_date":   endDay,
	})
}

// GetDailyVisitDetail 管理员下钻某位访客（登录用户 user_id 或匿名 ip）在日期范围内的导航明细。
func GetDailyVisitDetail(c *gin.Context) {
	startDay, endDay, err := parseVisitRange(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userId := 0
	if v, err := strconv.Atoi(c.Query("user_id")); err == nil && v > 0 {
		userId = v
	}
	ip := strings.TrimSpace(c.Query("ip"))
	if userId <= 0 && ip == "" {
		common.ApiError(c, errors.New("user_id or ip is required"))
		return
	}
	pageInfo := common.GetPageQuery(c)
	rows, total, err := model.GetDailyVisitDetail(startDay, endDay, userId, ip, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(rows)
	common.ApiSuccess(c, pageInfo)
}
