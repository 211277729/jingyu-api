package controller

import (
	"encoding/json"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// 资源广场的字段约束：既用于后台保存校验，也作为公开接口的容错边界。
const (
	resourceSlugMaxLen      = 64
	resourceNameMaxLen      = 128
	resourceTagMaxCount     = 20
	resourceTagMaxLen       = 32
	resourceHighlightMax    = 12
	resourceHighlightMaxLen = 200
	resourceUrlMaxLen       = 512
	resourceSortOrderMax    = 99999
	resourceIconNameMaxLen  = 64
)

var resourceSlugPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,63}$`)

// 资源条目的校验错误：英文原文经 ApiError 直达前端，message_key 供控制台翻译。
var (
	errResourceSlugRequired       = common.NewMessage("Slug is required")
	errResourceSlugInvalid        = common.NewMessage("Slug can only contain lowercase letters, digits and hyphens (max 64 characters)")
	errResourceSlugTaken          = common.NewMessage("This slug is already used by another resource")
	errResourceNameRequired       = common.NewMessage("Name is required")
	errResourceKindInvalid        = common.NewMessage("Kind must be one of mcp, skill or agent-tool")
	errResourceVendorInvalid      = common.NewMessage("Vendor must be Official or Community")
	errResourceSummaryRequired    = common.NewMessage("At least one of the Chinese or English summary is required")
	errResourceMcpRequired        = common.NewMessage("MCP servers require a launch command")
	errResourceMcpCommandRequired = common.NewMessage("MCP command is required")
	errResourceUrlInvalid         = common.NewMessage("Links must be full http(s) URLs")
	errResourceFieldTooLong       = common.NewMessage("One of the fields is too long")
	errResourceTooManyItems       = common.NewMessage("Too many tags or highlights")
	errResourceIdRequired         = common.NewMessage("Resource id is required")
	errResourceNotFound           = common.NewMessage("Resource not found")
	errErrorInvalidResourceId     = common.NewMessage("Invalid resource id")
)

// resourceMcpConfig MCP 服务器的 stdio 启动参数，前端按客户端生成安装片段。
type resourceMcpConfig struct {
	Name    string            `json:"name"`
	Command string            `json:"command"`
	Args    []string          `json:"args"`
	Env     map[string]string `json:"env,omitempty"`
}

// resourceText 双语文案：前台按界面语言二选一。
type resourceText struct {
	Zh string `json:"zh"`
	En string `json:"en"`
}

// resourceTextList 双语列表，用于亮点。
type resourceTextList struct {
	Zh []string `json:"zh"`
	En []string `json:"en"`
}

// resourcePublicItem 前台资源广场的数据形状：与前端 ResourceItem 一一对应。
type resourcePublicItem struct {
	Id          int                `json:"id"`
	Slug        string             `json:"slug"`
	Name        string             `json:"name"`
	Kind        string             `json:"kind"`
	IconName    string             `json:"icon_name"`
	Vendor      string             `json:"vendor"`
	Tags        []string           `json:"tags"`
	Summary     resourceText       `json:"summary"`
	Description resourceText       `json:"description"`
	Highlights  resourceTextList   `json:"highlights"`
	Mcp         *resourceMcpConfig `json:"mcp,omitempty"`
	// Content Markdown 正文：技能的核心用法说明，详情页原样渲染。
	Content        string `json:"content"`
	InstallCommand string `json:"install_command"`
	DownloadUrl    string `json:"download_url"`
	RepoUrl        string `json:"repo_url"`
	SortOrder      int    `json:"sort_order"`
}

// resourceAdminItem 管理端条目：在公开字段上补启用状态与时间戳。
type resourceAdminItem struct {
	resourcePublicItem
	Enabled   bool  `json:"enabled"`
	CreatedAt int64 `json:"created_at"`
	UpdatedAt int64 `json:"updated_at"`
}

// resourcePayload 后台保存请求体：双语分字段提交，服务端负责拼装 JSON 列。
type resourcePayload struct {
	Id             int                `json:"id"`
	Slug           string             `json:"slug"`
	Name           string             `json:"name"`
	Kind           string             `json:"kind"`
	IconName       string             `json:"icon_name"`
	Vendor         string             `json:"vendor"`
	Tags           []string           `json:"tags"`
	SummaryZh      string             `json:"summary_zh"`
	SummaryEn      string             `json:"summary_en"`
	DescriptionZh  string             `json:"description_zh"`
	DescriptionEn  string             `json:"description_en"`
	HighlightsZh   []string           `json:"highlights_zh"`
	HighlightsEn   []string           `json:"highlights_en"`
	Mcp            *resourceMcpConfig `json:"mcp"`
	Content        string             `json:"content"`
	InstallCommand string             `json:"install_command"`
	DownloadUrl    string             `json:"download_url"`
	RepoUrl        string             `json:"repo_url"`
	SortOrder      int                `json:"sort_order"`
	Enabled        bool               `json:"enabled"`
}

// parseResourceStringList 容错解析 JSON 字符串数组，坏数据按空数组处理。
func parseResourceStringList(raw string) []string {
	result := make([]string, 0)
	if strings.TrimSpace(raw) == "" {
		return result
	}
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return make([]string, 0)
	}
	if result == nil {
		return make([]string, 0)
	}
	return result
}

// parseResourceMcpConfig 容错解析 MCP 启动参数；解析失败视为"未配置安装方式"。
func parseResourceMcpConfig(raw string) *resourceMcpConfig {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	config := &resourceMcpConfig{}
	if err := json.Unmarshal([]byte(raw), config); err != nil {
		return nil
	}
	if strings.TrimSpace(config.Command) == "" {
		return nil
	}
	if config.Args == nil {
		config.Args = make([]string, 0)
	}
	return config
}

func toResourcePublicItem(resource *model.Resource) resourcePublicItem {
	return resourcePublicItem{
		Id:       resource.Id,
		Slug:     resource.Slug,
		Name:     resource.Name,
		Kind:     resource.Kind,
		IconName: resource.IconName,
		Vendor:   resource.Vendor,
		Tags:     parseResourceStringList(resource.Tags),
		Summary: resourceText{
			Zh: resource.SummaryZh,
			En: resource.SummaryEn,
		},
		Description: resourceText{
			Zh: resource.DescriptionZh,
			En: resource.DescriptionEn,
		},
		Highlights: resourceTextList{
			Zh: parseResourceStringList(resource.HighlightsZh),
			En: parseResourceStringList(resource.HighlightsEn),
		},
		Mcp:            parseResourceMcpConfig(resource.McpConfig),
		Content:        resource.Content,
		InstallCommand: resource.InstallCommand,
		DownloadUrl:    resource.DownloadUrl,
		RepoUrl:        resource.RepoUrl,
		SortOrder:      resource.SortOrder,
	}
}

func toResourceAdminItem(resource *model.Resource) resourceAdminItem {
	return resourceAdminItem{
		resourcePublicItem: toResourcePublicItem(resource),
		Enabled:            resource.Enabled,
		CreatedAt:          resource.CreatedAt,
		UpdatedAt:          resource.UpdatedAt,
	}
}

// GetPublicResourceList 前台资源广场的唯一数据源：只返回已启用条目。
// 路由上挂了 HeaderNavModuleAuth("resources")，与顶栏「资源广场」开关联动。
func GetPublicResourceList(c *gin.Context) {
	resources, err := model.GetEnabledResources()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]resourcePublicItem, 0, len(resources))
	for _, resource := range resources {
		items = append(items, toResourcePublicItem(resource))
	}
	common.ApiSuccess(c, gin.H{"items": items})
}

// GetResourceAdminList 后台资源管理分页列表，支持关键字、类别与启用状态筛选。
func GetResourceAdminList(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	resources, total, err := model.GetResourcePage(
		c.Query("kind"),
		c.Query("keyword"),
		c.Query("enabled"),
		pageInfo.GetStartIdx(),
		pageInfo.GetPageSize(),
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items := make([]resourceAdminItem, 0, len(resources))
	for _, resource := range resources {
		items = append(items, toResourceAdminItem(resource))
	}
	common.ApiSuccess(c, gin.H{
		"page":      pageInfo.GetPage(),
		"page_size": pageInfo.GetPageSize(),
		"total":     total,
		"items":     items,
	})
}

// AddResource 新建资源条目。
func AddResource(c *gin.Context) {
	payload := resourcePayload{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := validateResourcePayload(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	if exists, err := model.ResourceSlugExists(payload.Slug, 0); err != nil {
		common.ApiError(c, err)
		return
	} else if exists {
		common.ApiError(c, errResourceSlugTaken)
		return
	}

	resource := &model.Resource{}
	if err := applyResourcePayload(resource, &payload); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := resource.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, toResourceAdminItem(resource))
}

// UpdateResource 全量更新资源条目（id 放在请求体里，路径上不占用 :id）。
func UpdateResource(c *gin.Context) {
	payload := resourcePayload{}
	if err := c.ShouldBindJSON(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	if payload.Id <= 0 {
		common.ApiError(c, errResourceIdRequired)
		return
	}
	resource, err := model.GetResourceById(payload.Id)
	if err != nil {
		common.ApiError(c, errResourceNotFound)
		return
	}
	if err := validateResourcePayload(&payload); err != nil {
		common.ApiError(c, err)
		return
	}
	if exists, err := model.ResourceSlugExists(payload.Slug, payload.Id); err != nil {
		common.ApiError(c, err)
		return
	} else if exists {
		common.ApiError(c, errResourceSlugTaken)
		return
	}

	if err := applyResourcePayload(resource, &payload); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := resource.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, toResourceAdminItem(resource))
}

// DeleteResource 删除条目；不存在时按 404 语义返回明确错误。
func DeleteResource(c *gin.Context) {
	id, err := parseResourceIdParam(c.Param("id"))
	if err != nil {
		common.ApiError(c, errErrorInvalidResourceId)
		return
	}
	resource, err := model.GetResourceById(id)
	if err != nil {
		common.ApiError(c, errResourceNotFound)
		return
	}
	if err := resource.Delete(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func parseResourceIdParam(raw string) (int, error) {
	id, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || id <= 0 {
		return 0, errErrorInvalidResourceId
	}
	return id, nil
}

// normalizeResourceStringList 去空白、去空项、去重并校验条数与长度。
func normalizeResourceStringList(input []string, maxCount int, maxLen int) ([]string, error) {
	result := make([]string, 0, len(input))
	seen := make(map[string]struct{}, len(input))
	for _, item := range input {
		value := strings.TrimSpace(item)
		if value == "" {
			continue
		}
		if len([]rune(value)) > maxLen {
			return nil, errResourceFieldTooLong
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	if len(result) > maxCount {
		return nil, errResourceTooManyItems
	}
	return result, nil
}

// validateResourcePayload 归一化 + 校验请求体，规则与后台表单保持一致。
func validateResourcePayload(payload *resourcePayload) error {
	payload.Slug = strings.ToLower(strings.TrimSpace(payload.Slug))
	payload.Name = strings.TrimSpace(payload.Name)
	payload.Kind = strings.TrimSpace(payload.Kind)
	payload.Vendor = strings.TrimSpace(payload.Vendor)
	payload.IconName = strings.TrimSpace(payload.IconName)
	payload.InstallCommand = strings.TrimSpace(payload.InstallCommand)
	payload.Content = strings.TrimSpace(payload.Content)
	payload.DownloadUrl = strings.TrimSpace(payload.DownloadUrl)
	payload.RepoUrl = strings.TrimSpace(payload.RepoUrl)

	if payload.Slug == "" {
		return errResourceSlugRequired
	}
	if len(payload.Slug) > resourceSlugMaxLen || !resourceSlugPattern.MatchString(payload.Slug) {
		return errResourceSlugInvalid
	}
	if payload.Name == "" {
		return errResourceNameRequired
	}
	if len([]rune(payload.Name)) > resourceNameMaxLen {
		return errResourceFieldTooLong
	}

	switch payload.Kind {
	case model.ResourceKindMCP, model.ResourceKindSkill, model.ResourceKindAgentTool:
	default:
		return errResourceKindInvalid
	}

	if payload.Vendor == "" {
		payload.Vendor = model.ResourceVendorOfficial
	}
	switch payload.Vendor {
	case model.ResourceVendorOfficial, model.ResourceVendorCommunity:
	default:
		return errResourceVendorInvalid
	}

	if len([]rune(payload.IconName)) > resourceIconNameMaxLen {
		return errResourceFieldTooLong
	}
	if payload.SortOrder < 0 {
		payload.SortOrder = 0
	}
	if payload.SortOrder > resourceSortOrderMax {
		payload.SortOrder = resourceSortOrderMax
	}

	tags, err := normalizeResourceStringList(payload.Tags, resourceTagMaxCount, resourceTagMaxLen)
	if err != nil {
		return err
	}
	payload.Tags = tags

	highlightsZh, err := normalizeResourceStringList(payload.HighlightsZh, resourceHighlightMax, resourceHighlightMaxLen)
	if err != nil {
		return err
	}
	payload.HighlightsZh = highlightsZh
	highlightsEn, err := normalizeResourceStringList(payload.HighlightsEn, resourceHighlightMax, resourceHighlightMaxLen)
	if err != nil {
		return err
	}
	payload.HighlightsEn = highlightsEn

	payload.SummaryZh = strings.TrimSpace(payload.SummaryZh)
	payload.SummaryEn = strings.TrimSpace(payload.SummaryEn)
	if payload.SummaryZh == "" && payload.SummaryEn == "" {
		return errResourceSummaryRequired
	}
	payload.DescriptionZh = strings.TrimSpace(payload.DescriptionZh)
	payload.DescriptionEn = strings.TrimSpace(payload.DescriptionEn)

	// 正文不设长度上限：技能正文本身就是一份 Markdown 文档，截断反而难用；
	// 只做首尾去空白（在函数开头统一处理）。

	if err := validateResourceUrl(payload.DownloadUrl); err != nil {
		return err
	}
	if err := validateResourceUrl(payload.RepoUrl); err != nil {
		return err
	}

	if payload.Kind == model.ResourceKindMCP {
		if payload.Mcp == nil {
			return errResourceMcpRequired
		}
		payload.Mcp.Name = strings.TrimSpace(payload.Mcp.Name)
		if payload.Mcp.Name == "" {
			payload.Mcp.Name = payload.Slug
		}
		payload.Mcp.Command = strings.TrimSpace(payload.Mcp.Command)
		if payload.Mcp.Command == "" {
			return errResourceMcpCommandRequired
		}
		args := make([]string, 0, len(payload.Mcp.Args))
		for _, arg := range payload.Mcp.Args {
			arg = strings.TrimSpace(arg)
			if arg == "" {
				continue
			}
			args = append(args, arg)
		}
		payload.Mcp.Args = args
		if len(payload.Mcp.Env) == 0 {
			payload.Mcp.Env = nil
		}
	} else {
		// 只有 MCP 条目需要启动参数，其余类别不落库，避免脏配置。
		payload.Mcp = nil
	}

	return nil
}

func validateResourceUrl(raw string) error {
	if raw == "" {
		return nil
	}
	if len(raw) > resourceUrlMaxLen {
		return errResourceFieldTooLong
	}
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Host == "" {
		return errResourceUrlInvalid
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return errResourceUrlInvalid
	}
	return nil
}

// applyResourcePayload 把校验过的请求体写进模型（JSON 列在这里序列化）。
func applyResourcePayload(resource *model.Resource, payload *resourcePayload) error {
	tagsJson, err := json.Marshal(payload.Tags)
	if err != nil {
		return err
	}
	highlightsZhJson, err := json.Marshal(payload.HighlightsZh)
	if err != nil {
		return err
	}
	highlightsEnJson, err := json.Marshal(payload.HighlightsEn)
	if err != nil {
		return err
	}
	mcpJson := ""
	if payload.Mcp != nil {
		encoded, err := json.Marshal(payload.Mcp)
		if err != nil {
			return err
		}
		mcpJson = string(encoded)
	}

	resource.Slug = payload.Slug
	resource.Name = payload.Name
	resource.Kind = payload.Kind
	resource.IconName = payload.IconName
	resource.Vendor = payload.Vendor
	resource.Tags = string(tagsJson)
	resource.SummaryZh = payload.SummaryZh
	resource.SummaryEn = payload.SummaryEn
	resource.DescriptionZh = payload.DescriptionZh
	resource.DescriptionEn = payload.DescriptionEn
	resource.HighlightsZh = string(highlightsZhJson)
	resource.HighlightsEn = string(highlightsEnJson)
	resource.McpConfig = mcpJson
	resource.Content = payload.Content
	resource.InstallCommand = payload.InstallCommand
	resource.DownloadUrl = payload.DownloadUrl
	resource.RepoUrl = payload.RepoUrl
	resource.SortOrder = payload.SortOrder
	resource.Enabled = payload.Enabled
	return nil
}
