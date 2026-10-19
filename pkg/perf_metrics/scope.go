package perfmetrics

import (
	"math"

	"github.com/QuantumNous/new-api/model"
)

// PublishedScope tells a client which request population the published speed
// numbers cover, so a scoped figure is never shown without its definition.
type PublishedScope struct {
	Mode             string `json:"mode"`
	PromptTokenLimit int    `json:"prompt_token_limit,omitempty"`
	Note             string `json:"note,omitempty"`
}

func BuildScope(mode string, promptTokenLimit int, note string) *PublishedScope {
	if mode == "" {
		return nil
	}
	return &PublishedScope{Mode: mode, PromptTokenLimit: promptTokenLimit, Note: note}
}

// scopedSpeed derives the published latency and throughput of one aggregated row.
// Throughput uses the generation window (total time minus first-token latency) so
// it stays comparable with the unscoped calculation.
func scopedSpeed(stat model.PromptScopedStat) (latencyMs int64, tps float64) {
	if stat.RequestCount <= 0 {
		return 0, 0
	}
	latencyMs = stat.TotalUseTimeMs / stat.RequestCount
	if generation := stat.TotalUseTimeMs - stat.TtftSumMs; generation > 0 {
		tps = math.Round(float64(stat.CompletionTokens)/(float64(generation)/1000)*100) / 100
	}
	return latencyMs, tps
}

func scopedTotals(stats []model.PromptScopedStat) model.PromptScopedStat {
	var total model.PromptScopedStat
	for _, stat := range stats {
		total.RequestCount += stat.RequestCount
		total.TotalUseTimeMs += stat.TotalUseTimeMs
		total.CompletionTokens += stat.CompletionTokens
		total.TtftSumMs += stat.TtftSumMs
		total.TtftCount += stat.TtftCount
	}
	return total
}

// ApplySummaryScope replaces the published speed numbers of every model that has
// enough scoped samples. Success rate, request counts and the hourly success
// series keep the full population: error logs carry no input size, so scoping
// them would silently drop failures.
func ApplySummaryScope(result SummaryAllResult, stats []model.PromptScopedStat, minSamples int, scope *PublishedScope) SummaryAllResult {
	if scope == nil || len(stats) == 0 {
		return result
	}
	byModel := make(map[string]model.PromptScopedStat, len(stats))
	for _, stat := range stats {
		byModel[stat.Key] = stat
	}
	for i := range result.Models {
		stat, ok := byModel[result.Models[i].ModelName]
		if !ok || stat.RequestCount < int64(minSamples) {
			continue
		}
		latencyMs, tps := scopedSpeed(stat)
		result.Models[i].AvgLatencyMs = latencyMs
		result.Models[i].AvgTps = tps
	}
	totalLatency, totalTps := scopedSpeed(scopedTotals(stats))
	if result.Summary != nil {
		result.Summary.AvgLatencyMs = totalLatency
		result.Summary.AvgTps = totalTps
	}
	result.MetricsScope = scope
	return result
}

// ApplyQueryScope applies the same override to one model's detail view: the
// summary, every group row and the hourly latency series.
func ApplyQueryScope(result QueryResult, groupStats, hourStats []model.PromptScopedStat, minSamples int, scope *PublishedScope) QueryResult {
	if scope == nil {
		return result
	}
	byGroup := make(map[string]model.PromptScopedStat, len(groupStats))
	for _, stat := range groupStats {
		byGroup[stat.Key] = stat
	}
	for i := range result.Groups {
		stat, ok := byGroup[result.Groups[i].Group]
		if !ok || stat.RequestCount < int64(minSamples) {
			continue
		}
		latencyMs, tps := scopedSpeed(stat)
		result.Groups[i].AvgLatencyMs = latencyMs
		result.Groups[i].AvgTps = tps
		if stat.TtftCount > 0 {
			result.Groups[i].AvgTtftMs = stat.TtftSumMs / stat.TtftCount
		}
	}

	byHour := make(map[int64]model.PromptScopedStat, len(hourStats))
	for _, stat := range hourStats {
		byHour[stat.BucketTs] = stat
	}
	series := make([]BucketPoint, 0, len(result.Series))
	for _, point := range result.Series {
		stat, ok := byHour[point.Ts]
		if !ok {
			continue
		}
		latencyMs, tps := scopedSpeed(stat)
		point.AvgLatencyMs = latencyMs
		point.AvgTps = tps
		if stat.TtftCount > 0 {
			point.AvgTtftMs = stat.TtftSumMs / stat.TtftCount
		}
		series = append(series, point)
	}
	if len(series) > 0 {
		result.Series = series
	}

	if total := scopedTotals(hourStats); total.RequestCount > 0 && result.Summary != nil {
		latencyMs, tps := scopedSpeed(total)
		result.Summary.AvgLatencyMs = latencyMs
		result.Summary.AvgTps = tps
	}
	result.MetricsScope = scope
	return result
}
