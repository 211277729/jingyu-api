package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

// 官方价同步:从 models.dev 拉取官方定价,精确匹配本站启用模型,
// 写入展示专用配置 OfficialModelRatio(不影响任何计费)。

type OfficialPriceCandidate struct {
	ModelName string   `json:"model_name"`
	Provider  string   `json:"provider"`
	Input     float64  `json:"input"`
	Output    *float64 `json:"output,omitempty"`
	CacheRead *float64 `json:"cache_read,omitempty"`
}

// OfficialPriceSyncModel 描述一个本站启用模型的映射情况:
// Options 是该模型名在 models.dev 上的全部同名候选(可能来自多个 provider),
// Auto 是按「最便宜非零输入价」启发式选出的默认候选(可能选错,允许人工改)。
// ExistingSource 是当前配置里该模型条目的来源:"manual" 表示人工修改过,
// 管理端弹框默认不勾选,避免同步覆盖人工改过的价。
type OfficialPriceSyncModel struct {
	SiteModel      string                   `json:"site_model"`
	Options        []OfficialPriceCandidate `json:"options"`
	Auto           *OfficialPriceCandidate  `json:"auto,omitempty"`
	ExistingSource string                   `json:"existing_source,omitempty"`
}

type OfficialPriceSyncReport struct {
	Models     []OfficialPriceSyncModel `json:"models"`
	Candidates []OfficialPriceCandidate `json:"candidates"`
}

// OfficialPriceMappingRef 弹框确认后下发的映射目标:(model_name, provider) 唯一
// 确定 models.dev 上的一个候选。
type OfficialPriceMappingRef struct {
	Provider  string `json:"provider"`
	ModelName string `json:"model_name"`
}

type OfficialPriceSkip struct {
	SiteModel string `json:"site_model"`
	Reason    string `json:"reason"`
}

type OfficialPriceApplyReport struct {
	Applied []string            `json:"applied"`
	Skipped []OfficialPriceSkip `json:"skipped"`
}

// fetchModelsDevCandidates 拉取 models.dev /api.json 并解析为候选价格列表
// (同名模型保留全部 provider 的候选,不静默去重)
func fetchModelsDevCandidates(ctx context.Context) (map[string][]modelsDevCandidate, error) {
	dialer := &net.Dialer{Timeout: 10 * time.Second}
	transport := &http.Transport{MaxIdleConns: 10, IdleConnTimeout: 90 * time.Second, TLSHandshakeTimeout: 10 * time.Second, ExpectContinueTimeout: 1 * time.Second, ResponseHeaderTimeout: 15 * time.Second}
	if common.TLSInsecureSkipVerify {
		transport.TLSClientConfig = common.InsecureTLSConfig.Clone()
	}
	transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
		host, _, err := net.SplitHostPort(addr)
		if err != nil {
			host = addr
		}
		// models.dev 优先 IPv4,失败回退 IPv6(与 ratio_sync 的 github.io 策略一致)
		if host == modelsDevHost {
			if conn, err := dialer.DialContext(ctx, "tcp4", addr); err == nil {
				return conn, nil
			}
		}
		return dialer.DialContext(ctx, network, addr)
	}
	client := &http.Client{Transport: transport}

	fullURL := modelsDevPresetBaseURL + modelsDevPath
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, fullURL, nil)
	if err != nil {
		return nil, err
	}

	// 最多 3 次,指数退避(与 ratio_sync 保持一致)
	var resp *http.Response
	var lastErr error
	for attempt := range 3 {
		resp, lastErr = client.Do(httpReq)
		if lastErr == nil {
			break
		}
		time.Sleep(time.Duration(200*(1<<attempt)) * time.Millisecond)
	}
	if lastErr != nil {
		return nil, lastErr
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("models.dev returned %s", resp.Status)
	}

	limited := io.LimitReader(resp.Body, maxRatioConfigBytes)
	return collectModelsDevCandidates(bytes.NewReader(mustReadAll(limited)))
}

func mustReadAll(r io.Reader) []byte {
	data, err := io.ReadAll(r)
	if err != nil {
		// selectModelsDevCandidates 会再解码一次,这里读失败直接返回空让其报错
		return nil
	}
	return data
}

// candidateToEntry 将 models.dev 候选转换为官方价展示条目(换算公式与 ratio_sync 一致)
// officialModelName: 官方源中的模型名
func candidateToEntry(candidate modelsDevCandidate, officialModelName string) ratio_setting.OfficialPriceEntry {
	entry := ratio_setting.OfficialPriceEntry{
		OfficialModelName: officialModelName,
		Source:            ratio_setting.OfficialPriceSourceSync,
	}
	if candidate.Input == 0 {
		entry.ModelRatio = 0
		return entry
	}
	entry.ModelRatio = candidate.Input * float64(ratio_setting.USD) / modelsDevInputCostRatioBase
	if candidate.Output != nil {
		entry.CompletionRatio = roundRatioValue(*candidate.Output / candidate.Input)
	}
	if candidate.CacheRead != nil {
		cacheRatio := roundRatioValue(*candidate.CacheRead / candidate.Input)
		entry.CacheRatio = &cacheRatio
	}
	entry.ModelRatio = roundRatioValue(entry.ModelRatio)
	return entry
}

// candidateGroupToRefs 将同名候选组转换为对外结构(组内已按 provider 排序)
func candidateGroupToRefs(group []modelsDevCandidate, modelName string) []OfficialPriceCandidate {
	refs := make([]OfficialPriceCandidate, 0, len(group))
	for _, cand := range group {
		refs = append(refs, OfficialPriceCandidate{
			ModelName: modelName,
			Provider:  cand.Provider,
			Input:     cand.Input,
			Output:    cloneFloatPtr(cand.Output),
			CacheRead: cloneFloatPtr(cand.CacheRead),
		})
	}
	return refs
}

// bestModelsDevCandidate 对同名候选组应用「最便宜非零输入价,同价按 provider
// 名称稳定裁决」的启发式,返回默认候选。列表非空时必有返回。
func bestModelsDevCandidate(group []modelsDevCandidate) modelsDevCandidate {
	best := group[0]
	for _, cand := range group[1:] {
		if shouldReplaceModelsDevCandidate(best, cand) {
			best = cand
		}
	}
	return best
}

// SyncOfficialPrice POST /api/official_price/sync
// 仅预览,不写任何配置。返回每个启用模型的同名候选列表(models.dev 上同一
// 模型名常出现在多个 provider 下,价格可能不同)与启发式默认候选,由管理端
// 弹框展示并在人工确认后调用 /apply 写入。
func SyncOfficialPrice(c *gin.Context) {
	var req struct{}
	if err := c.ShouldBindJSON(&req); err != nil && !errors.Is(err, io.EOF) {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid request parameter format"))
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	allCandidates, err := fetchModelsDevCandidates(ctx)
	if err != nil {
		logger.LogWarn(c.Request.Context(), common.LogText("official price sync fetch failed: %s", err.Error()))
		common.ApiErrorMsg(c, "Failed to fetch models.dev pricing: "+err.Error())
		return
	}

	// 当前启用模型(从现有 pricing 缓存取,已含禁用过滤)
	enabledModels := make([]string, 0)
	for _, pricing := range model.GetPricing() {
		enabledModels = append(enabledModels, pricing.ModelName)
	}
	sort.Strings(enabledModels)

	// 扁平候选列表(供未匹配模型人工搜索)只为启用模型构建:
	// models.dev api.json 是全量数据,为所有模型展开会把响应撑大、拖慢同步。
	// 人工搜索任意官方模型的完整候选仍由 ApplyOfficialPrice 按映射全量定位。
	names := make([]string, 0, len(enabledModels))
	for _, name := range enabledModels {
		if _, ok := allCandidates[name]; ok {
			names = append(names, name)
		}
	}
	truncated := false
	candidateList := make([]OfficialPriceCandidate, 0, len(names))
	for _, name := range names {
		candidateList = append(candidateList, candidateGroupToRefs(allCandidates[name], name)...)
	}

	modelReports := make([]OfficialPriceSyncModel, 0, len(enabledModels))
	for _, siteModel := range enabledModels {
		// Options 初始化为空 slice:未匹配到候选时保持 nil 会被序列化成 null,
		// 前端按数组读取(model.options.length)会直接抛 TypeError。
		report := OfficialPriceSyncModel{SiteModel: siteModel, Options: []OfficialPriceCandidate{}}
		if existing, ok := ratio_setting.GetOfficialPrice(siteModel); ok {
			report.ExistingSource = existing.Source
		}
		if group, ok := allCandidates[siteModel]; ok {
			report.Options = candidateGroupToRefs(group, siteModel)
			auto := bestModelsDevCandidate(group)
			report.Auto = &OfficialPriceCandidate{
				ModelName: siteModel,
				Provider:  auto.Provider,
				Input:     auto.Input,
				Output:    cloneFloatPtr(auto.Output),
				CacheRead: cloneFloatPtr(auto.CacheRead),
			}
		}
		modelReports = append(modelReports, report)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"data":      OfficialPriceSyncReport{Models: modelReports, Candidates: candidateList},
		"truncated": truncated,
	})
}

// ApplyOfficialPrice POST /api/official_price/apply
// 请求: { mappings: { 站点模型名: { provider, model_name } } }
// 只写入弹框中确认过的映射;未出现在 mappings 里的站点模型保留现有配置。
// 服务端重新拉取 models.dev,按 (model_name, provider) 精确定位候选。
func ApplyOfficialPrice(c *gin.Context) {
	var req struct {
		Mappings map[string]OfficialPriceMappingRef `json:"mappings"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid request parameter format"))
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	allCandidates, err := fetchModelsDevCandidates(ctx)
	if err != nil {
		logger.LogWarn(c.Request.Context(), common.LogText("official price apply fetch failed: %s", err.Error()))
		common.ApiErrorMsg(c, "Failed to fetch models.dev pricing: "+err.Error())
		return
	}

	merged := ratio_setting.GetOfficialModelRatioCopy()
	report := OfficialPriceApplyReport{
		Applied: make([]string, 0, len(req.Mappings)),
		Skipped: make([]OfficialPriceSkip, 0),
	}

	siteModels := make([]string, 0, len(req.Mappings))
	for siteModel := range req.Mappings {
		siteModels = append(siteModels, siteModel)
	}
	sort.Strings(siteModels)

	for _, siteModel := range siteModels {
		ref := req.Mappings[siteModel]
		if ref.ModelName == "" || ref.Provider == "" {
			report.Skipped = append(report.Skipped, OfficialPriceSkip{SiteModel: siteModel, Reason: "empty mapping"})
			continue
		}
		group, ok := allCandidates[ref.ModelName]
		if !ok {
			report.Skipped = append(report.Skipped, OfficialPriceSkip{SiteModel: siteModel, Reason: "candidate not found: " + ref.ModelName})
			continue
		}
		var selected *modelsDevCandidate
		for i := range group {
			if group[i].Provider == ref.Provider {
				selected = &group[i]
				break
			}
		}
		if selected == nil {
			report.Skipped = append(report.Skipped, OfficialPriceSkip{
				SiteModel: siteModel,
				Reason:    "provider not found: " + ref.Provider + "/" + ref.ModelName,
			})
			continue
		}
		merged[siteModel] = candidateToEntry(*selected, ref.ModelName)
		report.Applied = append(report.Applied, siteModel)
	}

	optionValue, err := marshalOfficialModelRatio(merged)
	if err != nil {
		common.ApiErrorMsg(c, "Failed to serialize official price config: "+err.Error())
		return
	}
	if err := model.UpdateOption("OfficialModelRatio", optionValue); err != nil {
		common.ApiErrorMsg(c, "Failed to save official price config: "+err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    report,
	})
}

func marshalOfficialModelRatio(entries map[string]ratio_setting.OfficialPriceEntry) (string, error) {
	// 借道 JSON 序列化,复用 UpdateOfficialModelRatioByJSONString 的校验路径
	data, err := json.Marshal(entries)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// GetOfficialPriceConfig GET /api/official_price
// 返回当前展示用官方价配置(条目表 + 官方价美元汇率)
func GetOfficialPriceConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"entries":       ratio_setting.GetOfficialModelRatioCopy(),
			"exchange_rate": ratio_setting.GetOfficialPriceExchangeRate(),
		},
	})
}

// UpdateOfficialPriceExchangeRate PUT /api/official_price/rate
// 请求: { exchange_rate: number } —— 官方价美元汇率(真实 USD -> 展示货币)
func UpdateOfficialPriceExchangeRate(c *gin.Context) {
	var req struct {
		ExchangeRate float64 `json:"exchange_rate"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid request parameter format"))
		return
	}
	if math.IsNaN(req.ExchangeRate) || math.IsInf(req.ExchangeRate, 0) || req.ExchangeRate <= 0 {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Exchange rate must be positive"))
		return
	}
	value := strconv.FormatFloat(req.ExchangeRate, 'f', -1, 64)
	if err := ratio_setting.UpdateOfficialPriceExchangeRate(value); err != nil {
		common.ApiErrorMsg(c, "Failed to update official price exchange rate: "+err.Error())
		return
	}
	if err := model.UpdateOption("OfficialPriceExchangeRate", value); err != nil {
		common.ApiErrorMsg(c, "Failed to save official price exchange rate: "+err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"exchange_rate": ratio_setting.GetOfficialPriceExchangeRate()},
	})
}

// UpdateOfficialPriceConfig PUT /api/official_price
// 请求体即 map[站点模型名]OfficialPriceEntry,整体替换(供管理端人工映射/行内编辑)
func UpdateOfficialPriceConfig(c *gin.Context) {
	var entries map[string]ratio_setting.OfficialPriceEntry
	if err := c.ShouldBindJSON(&entries); err != nil {
		common.ApiErrorStatus(c, http.StatusBadRequest, common.NewMessage("Invalid request parameter format"))
		return
	}
	data, err := json.Marshal(entries)
	if err != nil {
		common.ApiErrorMsg(c, "Failed to serialize official price config: "+err.Error())
		return
	}
	if err := model.UpdateOption("OfficialModelRatio", string(data)); err != nil {
		common.ApiErrorMsg(c, "Failed to save official price config: "+err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
