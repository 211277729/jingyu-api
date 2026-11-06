package ratio_setting

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"sync"
)

// 官方价展示配置:仅用于前台「官方价对比」展示,不参与任何计费。
// 外层 key 为本站模型名,value 记录来源官方模型名及其倍率(与计费倍率同单位)。
// 映射关系即条目本身:站点模型名 -> OfficialPriceEntry。

// OfficialPriceEntry 官方价展示条目。
// Source 记录条目来源:"sync"=models.dev 同步、"manual"=人工修改(同步弹框里
// 默认不勾选,避免覆盖人工改过的价)。
// Peak* 为高峰期官方价(可选):时段计费模型(计费表达式含 hour()/weekday()
// 分档)在当前时段命中高峰档时用 Peak* 展示,否则用基础档。models.dev 只提供
// 一档价,DeepSeek 等给的恰是低峰价,高峰价需管理端手动补填。
type OfficialPriceEntry struct {
	OfficialModelName   string   `json:"official_model_name"`
	ModelRatio          float64  `json:"model_ratio"`
	CompletionRatio     float64  `json:"completion_ratio"`
	Source              string   `json:"source,omitempty"`
	CacheRatio          *float64 `json:"cache_ratio,omitempty"`
	CreateCacheRatio    *float64 `json:"create_cache_ratio,omitempty"`
	PeakModelRatio      float64  `json:"peak_model_ratio,omitempty"`
	PeakCompletionRatio float64  `json:"peak_completion_ratio,omitempty"`
	PeakCacheRatio      *float64 `json:"peak_cache_ratio,omitempty"`
}

// HasPeakPrice 判断是否配置了高峰价(高峰输入价必须为正)
func (e OfficialPriceEntry) HasPeakPrice() bool {
	return e.PeakModelRatio > 0
}

// 官方价条目来源常量
const (
	OfficialPriceSourceSync   = "sync"
	OfficialPriceSourceManual = "manual"
)

var (
	officialModelRatioLock sync.RWMutex
	officialModelRatioMap  = make(map[string]OfficialPriceEntry)

	// officialPriceExchangeRate 官方价美元汇率:models.dev 的价格是真实美元,
	// 前台官方价按此汇率折算成站内展示货币(本站额度通常 1:1,不能用站点
	// 显示汇率,否则官方价会差一个汇率倍数)。
	officialPriceExchangeRate = DefaultOfficialPriceExchangeRate
)

// DefaultOfficialPriceExchangeRate 官方价美元汇率默认值(USD -> CNY 参考值)
const DefaultOfficialPriceExchangeRate = 7.3

// GetOfficialPriceExchangeRate 返回官方价美元汇率
func GetOfficialPriceExchangeRate() float64 {
	officialModelRatioLock.RLock()
	defer officialModelRatioLock.RUnlock()
	return officialPriceExchangeRate
}

// UpdateOfficialPriceExchangeRate 更新官方价美元汇率(非法值保持不变)
func UpdateOfficialPriceExchangeRate(value string) error {
	rate, err := parseExchangeRate(value)
	if err != nil {
		return err
	}
	officialModelRatioLock.Lock()
	defer officialModelRatioLock.Unlock()
	officialPriceExchangeRate = rate
	return nil
}

func parseExchangeRate(value string) (float64, error) {
	if value == "" {
		return DefaultOfficialPriceExchangeRate, nil
	}
	rate, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil {
		return 0, err
	}
	if math.IsNaN(rate) || math.IsInf(rate, 0) || rate <= 0 {
		return 0, fmt.Errorf("official price exchange rate must be positive, got %v", rate)
	}
	return rate, nil
}

// GetOfficialPrice 返回某个站点模型的官方价展示条目
func GetOfficialPrice(model string) (OfficialPriceEntry, bool) {
	officialModelRatioLock.RLock()
	defer officialModelRatioLock.RUnlock()
	entry, ok := officialModelRatioMap[model]
	return entry, ok
}

// GetOfficialModelRatioCopy 返回整个官方价展示配置的拷贝
func GetOfficialModelRatioCopy() map[string]OfficialPriceEntry {
	officialModelRatioLock.RLock()
	defer officialModelRatioLock.RUnlock()
	out := make(map[string]OfficialPriceEntry, len(officialModelRatioMap))
	for k, v := range officialModelRatioMap {
		out[k] = v
	}
	return out
}

// OfficialModelRatio2JSONString 序列化官方价展示配置(持久化到 options 表)
func OfficialModelRatio2JSONString() string {
	officialModelRatioLock.RLock()
	defer officialModelRatioLock.RUnlock()
	data, err := json.Marshal(officialModelRatioMap)
	if err != nil {
		return "{}"
	}
	return string(data)
}

// UpdateOfficialModelRatioByJSONString 从 JSON 字符串整体替换官方价展示配置
func UpdateOfficialModelRatioByJSONString(jsonStr string) error {
	parsed := make(map[string]OfficialPriceEntry)
	if jsonStr != "" {
		if err := json.Unmarshal([]byte(jsonStr), &parsed); err != nil {
			return err
		}
	}

	officialModelRatioLock.Lock()
	defer officialModelRatioLock.Unlock()
	officialModelRatioMap = parsed
	return nil
}
