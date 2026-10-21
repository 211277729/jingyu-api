package operation_setting

import (
	"fmt"
	"math"
	"strconv"

	"github.com/QuantumNous/new-api/setting/config"
)

// HiddenMarkupSetting 是计费处附加的隐藏加价倍率：它在最终扣费时生效，
// 但任何面向用户的展示（定价页、可用分组、用量日志）看到的仍是未加价的
// 配置倍率。值为 1 表示不加价。
type HiddenMarkupSetting struct {
	// Markup 是乘在生效倍率上的附加倍率，例如 1.2 表示多扣 20%。
	Markup float64 `json:"markup"`
}

// 默认配置
var hiddenMarkupSetting = HiddenMarkupSetting{
	Markup: 1,
}

func init() {
	config.GlobalConfig.Register("hidden_markup_setting", &hiddenMarkupSetting)
}

func GetHiddenMarkupSetting() *HiddenMarkupSetting {
	return &hiddenMarkupSetting
}

// GetHiddenMarkup 读取隐藏加价倍率，非法值按 1（不加价）处理。
func GetHiddenMarkup() float64 {
	markup := hiddenMarkupSetting.Markup
	if math.IsNaN(markup) || math.IsInf(markup, 0) || markup <= 0 {
		return 1
	}
	return markup
}

// ValidateHiddenMarkupOption 在持久化前校验隐藏加价倍率。
func ValidateHiddenMarkupOption(key, value string) error {
	if key != "hidden_markup_setting.markup" {
		return nil
	}
	number, err := strconv.ParseFloat(value, 64)
	if err != nil || math.IsNaN(number) || math.IsInf(number, 0) {
		return fmt.Errorf("%s must be a finite number", key)
	}
	if number < 0 {
		return fmt.Errorf("%s must be not less than 0", key)
	}
	return nil
}
