package model

import (
	"sync"
	"time"
)

// 隐藏（下架）模型缓存：models 元数据中 Status != 1 的记录。
// 元数据变更（创建/更新/删除/同步）经 RefreshPricing() → updatePricing()
// 即时重建；其余情况由 ensureHiddenModelCache 的分钟级 TTL 兜底。
var (
	hiddenModelLock      sync.RWMutex
	hiddenModelExact     = make(map[string]struct{})
	hiddenModelRules     []Model // prefix / suffix / contains 规则记录
	hiddenModelLastBuild time.Time
)

// rebuildHiddenModelCache runs inside updatePricing while updatePricingLock is
// held; readers only take hiddenModelLock, so no lock-order cycle exists.
func rebuildHiddenModelCache(allMeta []Model) {
	exact := make(map[string]struct{})
	rules := make([]Model, 0)
	for i := range allMeta {
		meta := allMeta[i]
		if meta.Status == 1 {
			continue
		}
		if meta.NameRule == NameRuleExact {
			exact[meta.ModelName] = struct{}{}
		} else {
			rules = append(rules, meta)
		}
	}
	hiddenModelLock.Lock()
	hiddenModelExact = exact
	hiddenModelRules = rules
	hiddenModelLastBuild = time.Now()
	hiddenModelLock.Unlock()
}

// ensureHiddenModelCache 懒加载隐藏缓存；不依赖定价缓存的构建路径，
// 因此 abilities 查询失败不会影响下架状态的可见性。
func ensureHiddenModelCache() {
	if DB == nil {
		// 无数据库环境（部分单测）视为无下架配置
		return
	}
	if time.Since(hiddenModelLastBuild) < time.Minute {
		return
	}
	updatePricingLock.Lock()
	defer updatePricingLock.Unlock()
	if time.Since(hiddenModelLastBuild) < time.Minute {
		return
	}
	var allMeta []Model
	_ = DB.Find(&allMeta).Error
	rebuildHiddenModelCache(allMeta)
}

// IsModelHidden 判断具体模型名是否已被下架（元数据 Status != 1），
// 匹配语义与模型广场一致：精确优先，其次前缀/后缀/包含规则。
func IsModelHidden(name string) bool {
	if name == "" {
		return false
	}
	ensureHiddenModelCache()
	hiddenModelLock.RLock()
	defer hiddenModelLock.RUnlock()
	if _, ok := hiddenModelExact[name]; ok {
		return true
	}
	for i := range hiddenModelRules {
		if hiddenModelRules[i].MatchesName(name) {
			return true
		}
	}
	return false
}

// FilterHiddenModels 从模型名列表中剔除已下架模型，供用户可见模型列表使用。
func FilterHiddenModels(names []string) []string {
	filtered := make([]string, 0, len(names))
	for _, name := range names {
		if !IsModelHidden(name) {
			filtered = append(filtered, name)
		}
	}
	return filtered
}
