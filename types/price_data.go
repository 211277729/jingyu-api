package types

import (
	"fmt"
	"math"

	"github.com/shopspring/decimal"
)

// Long-lived cache writes cost a fixed multiple of the short write price.
const (
	// https://docs.claude.com/en/docs/build-with-claude/prompt-caching#1-hour-cache-duration
	ClaudeCacheCreation1hMultiplier = 6 / 3.75
	// https://developers.openai.com/api/docs/guides/prompt-caching
	OpenAICacheCreation12hMultiplier = 2
)

type GroupRatioInfo struct {
	// GroupRatio 是最终计费采用的倍率，已包含计费处附加的隐藏加价。
	GroupRatio float64
	// DisplayGroupRatio 是未加价的配置倍率，只用于面向用户的展示，
	// 让隐藏加价不出现在定价页、可用分组和用量日志里。零值表示调用方
	// 未经 HandleGroupRatio 构造，展示时回退到 GroupRatio。
	DisplayGroupRatio float64
	// GroupSpecialRatio 与 HasSpecialRatio 描述用户专属倍率，仅用于展示，
	// 不参与隐藏加价。
	GroupSpecialRatio float64
	HasSpecialRatio   bool
}

// DisplayRatio 返回面向用户展示的倍率：优先用未加价的 DisplayGroupRatio，
// 未经 HandleGroupRatio 构造时回退到计费倍率。
func (g GroupRatioInfo) DisplayRatio() float64 {
	if g.DisplayGroupRatio > 0 {
		return g.DisplayGroupRatio
	}
	return g.GroupRatio
}

type PriceData struct {
	FreeModel             bool
	ModelPrice            float64
	ModelRatio            float64
	CompletionRatio       float64
	CacheRatio            float64
	CacheCreationRatio    float64
	CacheCreation5mRatio  float64
	CacheCreation1hRatio  float64
	CacheCreation12hRatio float64
	ImageRatio            float64
	AudioRatio            float64
	AudioCompletionRatio  float64
	otherRatios           map[string]float64
	UsePrice              bool
	Quota                 int // 按次计费的最终额度（MJ / Task）
	QuotaToPreConsume     int // 按量计费的预消耗额度
	GroupRatioInfo        GroupRatioInfo
}

func (p *PriceData) AddOtherRatio(key string, ratio float64) {
	if !isValidOtherRatio(ratio) {
		return
	}
	if p.otherRatios == nil {
		p.otherRatios = make(map[string]float64)
	}
	p.otherRatios[key] = ratio
}

func (p *PriceData) ReplaceOtherRatios(ratios map[string]float64) bool {
	p.otherRatios = nil
	for key, ratio := range ratios {
		p.AddOtherRatio(key, ratio)
	}
	return len(p.otherRatios) > 0
}

func (p *PriceData) HasOtherRatio(key string) bool {
	ratio, ok := p.otherRatios[key]
	return ok && isValidOtherRatio(ratio)
}

func (p *PriceData) OtherRatios() map[string]float64 {
	if len(p.otherRatios) == 0 {
		return nil
	}
	ratios := make(map[string]float64, len(p.otherRatios))
	for key, ratio := range p.otherRatios {
		if isValidOtherRatio(ratio) {
			ratios[key] = ratio
		}
	}
	if len(ratios) == 0 {
		return nil
	}
	return ratios
}

func (p *PriceData) OtherRatioMultiplier() float64 {
	multiplier := 1.0
	for _, ratio := range p.otherRatios {
		if isValidOtherRatio(ratio) && ratio != 1.0 {
			multiplier *= ratio
		}
	}
	return multiplier
}

func (p *PriceData) ApplyOtherRatiosToFloat(value float64) float64 {
	return value * p.OtherRatioMultiplier()
}

func (p *PriceData) ApplyOtherRatiosToDecimal(value decimal.Decimal) decimal.Decimal {
	for _, ratio := range p.otherRatios {
		if isValidOtherRatio(ratio) && ratio != 1.0 {
			value = value.Mul(decimal.NewFromFloat(ratio))
		}
	}
	return value
}

func (p *PriceData) RemoveOtherRatiosFromFloat(value float64) float64 {
	for _, ratio := range p.otherRatios {
		if isValidOtherRatio(ratio) && ratio != 1.0 {
			value /= ratio
		}
	}
	return value
}

func isValidOtherRatio(ratio float64) bool {
	return ratio > 0 && !math.IsInf(ratio, 1)
}

func (p *PriceData) ToSetting() string {
	return fmt.Sprintf("ModelPrice: %f, ModelRatio: %f, CompletionRatio: %f, CacheRatio: %f, GroupRatio: %f, UsePrice: %t, CacheCreationRatio: %f, CacheCreation5mRatio: %f, CacheCreation1hRatio: %f, CacheCreation12hRatio: %f, QuotaToPreConsume: %d, ImageRatio: %f, AudioRatio: %f, AudioCompletionRatio: %f, DisplayGroupRatio: %f", p.ModelPrice, p.ModelRatio, p.CompletionRatio, p.CacheRatio, p.GroupRatioInfo.GroupRatio, p.UsePrice, p.CacheCreationRatio, p.CacheCreation5mRatio, p.CacheCreation1hRatio, p.CacheCreation12hRatio, p.QuotaToPreConsume, p.ImageRatio, p.AudioRatio, p.AudioCompletionRatio, p.GroupRatioInfo.DisplayGroupRatio)
}
