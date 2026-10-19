package controller

import (
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

// perfScopeCacheTTL bounds how often the published scope re-reads the log window.
// The scope aggregate is served on a public page, so a page view must not scan
// the log table; the numbers behind it only move as hourly buckets fill in.
const perfScopeCacheTTL = 5 * time.Minute

type perfScopeCacheEntry struct {
	at    time.Time
	limit int
	hours int
	stats []model.PromptScopedStat
}

var (
	perfScopeCacheMutex sync.Mutex
	perfScopeCache      = map[string]perfScopeCacheEntry{}
)

// promptScopedStats returns the cached aggregate for one dimension, or nil when
// the log database cannot serve the prompt scope (the caller then keeps the
// unscoped numbers).
func promptScopedStats(dimension model.PromptScopedDimension, limit int, hours int, modelName string) []model.PromptScopedStat {
	cacheKey := fmt.Sprintf("%s|%s", dimension, modelName)
	perfScopeCacheMutex.Lock()
	defer perfScopeCacheMutex.Unlock()
	if entry, ok := perfScopeCache[cacheKey]; ok && entry.limit == limit && entry.hours == hours && time.Since(entry.at) < perfScopeCacheTTL {
		return entry.stats
	}
	sinceTs := time.Now().Add(-time.Duration(hours) * time.Hour).Unix()
	stats, err := model.SumPromptScopedStats(sinceTs, limit, dimension, modelName)
	if err != nil {
		common.SysError(common.LogText("prompt scoped stats unavailable: %s", err.Error()))
		stats = nil
	}
	perfScopeCache[cacheKey] = perfScopeCacheEntry{at: time.Now(), limit: limit, hours: hours, stats: stats}
	return stats
}

// publishedScope describes the population the model square publishes. Nil keeps
// the full population, which is also the fallback when the scope is unset.
func publishedScope() *perfmetrics.PublishedScope {
	limit, scoped := perf_metrics_setting.PublishedScope()
	if !scoped {
		return nil
	}
	return perfmetrics.BuildScope(perf_metrics_setting.PublishedBucketShort, limit, perf_metrics_setting.Note())
}

func activePerfGroups() []string {
	return append(lo.Keys(ratio_setting.GetGroupRatioCopy()), "auto")
}

func GetPerfMetricsSummary(c *gin.Context) {
	hours := 24
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil {
			hours = parsed
		}
	}

	recentModels := c.QueryArray("recent_model")
	if len(recentModels) > perfmetrics.MaxRecentModels {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid parameters"))
		return
	}
	result, err := perfmetrics.QuerySummaryAll(hours, activePerfGroups(), recentModels...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	if scope := publishedScope(); scope != nil {
		result = perfmetrics.ApplySummaryScope(result, promptScopedStats(model.PromptScopedByModel, scope.PromptTokenLimit, hours, ""), perf_metrics_setting.MinSamples(), scope)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func GetPerfMetrics(c *gin.Context) {
	modelName := c.Query("model")
	if modelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "model is required",
		})
		return
	}

	hours := 24
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil {
			hours = parsed
		}
	}

	result, err := perfmetrics.Query(perfmetrics.QueryParams{
		Model:         modelName,
		Group:         c.Query("group"),
		Hours:         hours,
		AllowedGroups: activePerfGroups(),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	if scope := publishedScope(); scope != nil {
		result = perfmetrics.ApplyQueryScope(
			result,
			promptScopedStats(model.PromptScopedByGroup, scope.PromptTokenLimit, hours, modelName),
			promptScopedStats(model.PromptScopedByHour, scope.PromptTokenLimit, hours, modelName),
			perf_metrics_setting.MinSamples(),
			scope,
		)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}
