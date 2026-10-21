package perf_metrics_setting

import "github.com/QuantumNous/new-api/setting/config"

type PerfMetricsSetting struct {
	Enabled       bool   `json:"enabled"`
	FlushInterval int    `json:"flush_interval"`
	BucketTime    string `json:"bucket_time"`
	RetentionDays int    `json:"retention_days"`

	// PublishedBucket selects the request population the model square publishes:
	// "all" keeps every request, "short" keeps only requests whose input stays at
	// or under PublishedPromptTokenLimit (standard chat). The scoped numbers are
	// aggregated from consume logs, so the choice applies to existing history at
	// once instead of waiting for new samples.
	PublishedBucket string `json:"published_bucket"`
	// PublishedPromptTokenLimit is the input-token ceiling of the "short" bucket.
	PublishedPromptTokenLimit int `json:"published_prompt_token_limit"`
	// PublishedNote is shown next to the published latency. An empty value falls
	// back to the built-in scope sentence, so a scoped number is never published
	// without stating which population it covers.
	PublishedNote string `json:"published_note"`
	// PublishedMinSamples falls back to the full population when a model has too
	// few scoped samples, which would otherwise publish noise or a blank value.
	PublishedMinSamples int `json:"published_min_samples"`

	// PublishedTpsFactor multiplies the throughput the model square shows, so the
	// published speed can reach the provider's rated peak instead of the average of
	// the sampled window. 1 publishes the measurement unchanged.
	PublishedTpsFactor float64 `json:"published_tps_factor"`
	// PublishedTpsFloor is the smallest throughput published for a model that has
	// at least one measured streamed sample. 0 disables it.
	PublishedTpsFloor float64 `json:"published_tps_floor"`
	// PublishedTpsCeiling bounds the adjusted throughput so a sample spike cannot
	// publish an implausible speed. 0 disables it.
	PublishedTpsCeiling float64 `json:"published_tps_ceiling"`
}

var perfMetricsSetting = PerfMetricsSetting{
	Enabled:       true,
	FlushInterval: 5,
	BucketTime:    "hour",
	RetentionDays: 0,

	PublishedBucket:           PublishedBucketShort,
	PublishedPromptTokenLimit: 8000,
	PublishedNote:             "",
	PublishedMinSamples:       20,

	PublishedTpsFactor:  1,
	PublishedTpsFloor:   0,
	PublishedTpsCeiling: 0,
}

const (
	PublishedBucketAll   = "all"
	PublishedBucketShort = "short"
)

func init() {
	config.GlobalConfig.Register("perf_metrics_setting", &perfMetricsSetting)
}

func GetSetting() PerfMetricsSetting {
	return perfMetricsSetting
}

// PublishedScope reports the population the model square publishes. ok is false
// when every request is published, which keeps the existing aggregation path.
func PublishedScope() (promptTokenLimit int, ok bool) {
	if perfMetricsSetting.PublishedBucket != PublishedBucketShort {
		return 0, false
	}
	limit := perfMetricsSetting.PublishedPromptTokenLimit
	if limit <= 0 {
		return 0, false
	}
	return limit, true
}

// MinSamples is the smallest scoped sample count published for one model.
func MinSamples() int {
	if perfMetricsSetting.PublishedMinSamples < 1 {
		return 1
	}
	return perfMetricsSetting.PublishedMinSamples
}

// Note returns the operator-written scope sentence, empty when unset.
func Note() string {
	return perfMetricsSetting.PublishedNote
}

// TpsFactor is the multiplier applied to the published throughput. A value at or
// below zero keeps the measurement unchanged.
func TpsFactor() float64 {
	if perfMetricsSetting.PublishedTpsFactor <= 0 {
		return 1
	}
	return perfMetricsSetting.PublishedTpsFactor
}

// TpsFloor is the smallest throughput published for a model. Zero disables it.
func TpsFloor() float64 {
	if perfMetricsSetting.PublishedTpsFloor < 0 {
		return 0
	}
	return perfMetricsSetting.PublishedTpsFloor
}

// TpsCeiling bounds the adjusted throughput. Zero disables the bound.
func TpsCeiling() float64 {
	if perfMetricsSetting.PublishedTpsCeiling < 0 {
		return 0
	}
	return perfMetricsSetting.PublishedTpsCeiling
}

func GetBucketSeconds() int64 {
	switch perfMetricsSetting.BucketTime {
	case "minute":
		return 60
	case "5min":
		return 300
	case "hour":
		return 3600
	default:
		return 3600
	}
}

func GetFlushIntervalMinutes() int {
	if perfMetricsSetting.FlushInterval < 1 {
		return 1
	}
	return perfMetricsSetting.FlushInterval
}
