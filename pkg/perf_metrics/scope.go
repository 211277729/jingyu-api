package perfmetrics

import (
	"math"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
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

// adjustPublishedTps applies the operator's display settings to a measured
// throughput. Only the value rendered on the model square changes: the sampled
// numbers, the consume logs and the billing path keep the measurement.
// A model without a measured sample stays at zero so callers keep the
// full-population number instead of publishing a floor for it.
func adjustPublishedTps(measured float64) float64 {
	if measured <= 0 {
		return measured
	}
	adjusted := measured * perf_metrics_setting.TpsFactor()
	if floor := perf_metrics_setting.TpsFloor(); adjusted < floor {
		adjusted = floor
	}
	if ceiling := perf_metrics_setting.TpsCeiling(); ceiling > 0 && adjusted > ceiling {
		adjusted = ceiling
	}
	return math.Round(adjusted*100) / 100
}

// scopedSpeed derives the published latency and throughput of one aggregated row.
// Latency covers the whole in-scope population, while throughput only uses the
// streamed samples: a non-stream request has no measurable first token, so mixing
// it in would count its full duration as generation time and publish a speed far
// below what the model actually delivers.
func scopedSpeed(stat model.PromptScopedStat) (latencyMs int64, tps float64) {
	if stat.RequestCount <= 0 {
		return 0, 0
	}
	latencyMs = stat.TotalUseTimeMs / stat.RequestCount
	if stat.StreamGenerationMs > 0 {
		tps = adjustPublishedTps(float64(stat.StreamCompletionTokens) / (float64(stat.StreamGenerationMs) / 1000))
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
		total.StreamGenerationMs += stat.StreamGenerationMs
		total.StreamCompletionTokens += stat.StreamCompletionTokens
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
		// No streamed sample means no measurable generation speed. Keep the
		// full-population value instead of publishing a zero.
		if tps > 0 {
			result.Models[i].AvgTps = tps
		}
	}
	totalLatency, totalTps := scopedSpeed(scopedTotals(stats))
	if result.Summary != nil {
		result.Summary.AvgLatencyMs = totalLatency
		if totalTps > 0 {
			result.Summary.AvgTps = totalTps
		}
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
		if tps > 0 {
			result.Groups[i].AvgTps = tps
		}
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
		if tps > 0 {
			point.AvgTps = tps
		}
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
		if tps > 0 {
			result.Summary.AvgTps = tps
		}
	}
	result.MetricsScope = scope
	return result
}
