package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// 资源广场条目的类别与来源枚举：前端按 kind 分 tab，vendor 决定徽标文案。
const (
	ResourceKindMCP       = "mcp"
	ResourceKindSkill     = "skill"
	ResourceKindAgentTool = "agent-tool"

	ResourceVendorOfficial  = "Official"
	ResourceVendorCommunity = "Community"
)

// Resource 资源广场条目：MCP 服务器 / Agent 技能包 / Agent 工具。
//
// 双语文案按语言分列存储（列多一点，但查询和后台表单都最直白）；
// tags / highlights / mcp_config 存 JSON 文本，写入前由 controller 校验，
// 读取时容错解析，脏数据不会让整个列表接口失败。
type Resource struct {
	Id   int    `json:"id" gorm:"primaryKey;autoIncrement"`
	Slug string `json:"slug" gorm:"type:varchar(64);not null;uniqueIndex"`
	Name string `json:"name" gorm:"type:varchar(128);not null"`

	Kind     string `json:"kind" gorm:"type:varchar(16);not null;index"`
	IconName string `json:"icon_name" gorm:"type:varchar(64)"`
	Vendor   string `json:"vendor" gorm:"type:varchar(16);not null"`

	Tags string `json:"tags" gorm:"type:text"` // JSON: ["web","http"]

	SummaryZh     string `json:"summary_zh" gorm:"type:text"`
	SummaryEn     string `json:"summary_en" gorm:"type:text"`
	DescriptionZh string `json:"description_zh" gorm:"type:text"`
	DescriptionEn string `json:"description_en" gorm:"type:text"`
	HighlightsZh  string `json:"highlights_zh" gorm:"type:text"` // JSON: ["a","b"]
	HighlightsEn  string `json:"highlights_en" gorm:"type:text"`

	// McpConfig MCP 服务器的 stdio 启动参数：{"name","command","args","env"}
	McpConfig string `json:"mcp_config" gorm:"type:text"`

	// Content 技能 / 工具的正文（Markdown）：只收录核心用法与要点，
	// 完整内容走 DownloadUrl / RepoUrl（以后也可以换成 CDN 地址）。
	// not null + default 是为了给已有表补列时把历史行填成空串，避免扫出 NULL。
	Content string `json:"content" gorm:"type:text;not null;default:''"`

	InstallCommand string `json:"install_command" gorm:"type:text"`
	DownloadUrl    string `json:"download_url" gorm:"type:varchar(512)"`
	RepoUrl        string `json:"repo_url" gorm:"type:varchar(512)"`

	// SortOrder 同类别内的展示顺序，小的在前；0 表示未指定，按 id 兜底。
	SortOrder int `json:"sort_order" gorm:"not null"`
	// Enabled 关闭后前台不展示，也不会出现在公开接口里。
	// 刻意不加 gorm default，避免插入时零值被默认值覆盖（false 要能落库）。
	Enabled bool `json:"enabled" gorm:"not null;index"`

	CreatedAt int64 `json:"created_at" gorm:"bigint"`
	UpdatedAt int64 `json:"updated_at" gorm:"bigint"`
}

func (Resource) TableName() string {
	return "resources"
}

// GetEnabledResources 公开接口用：只取启用条目，按 sort_order、id 升序。
func GetEnabledResources() ([]*Resource, error) {
	items := make([]*Resource, 0)
	err := DB.Where("enabled = ?", true).
		Order("sort_order asc, id asc").
		Find(&items).Error
	return items, err
}

// GetResourcePage 管理端分页查询：keyword 匹配名称/slug/标签，kind 与 enabled 可选过滤。
func GetResourcePage(kind string, keyword string, enabled string, startIdx int, num int) ([]*Resource, int64, error) {
	query := DB.Model(&Resource{})

	if kind = strings.TrimSpace(kind); kind != "" {
		query = query.Where("kind = ?", kind)
	}
	switch strings.TrimSpace(enabled) {
	case "true":
		query = query.Where("enabled = ?", true)
	case "false":
		query = query.Where("enabled = ?", false)
	}
	if keyword = strings.TrimSpace(keyword); keyword != "" {
		like := "%" + strings.ToLower(keyword) + "%"
		query = query.Where(
			"LOWER(name) LIKE ? OR LOWER(slug) LIKE ? OR LOWER(tags) LIKE ?",
			like, like, like,
		)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	items := make([]*Resource, 0)
	err := query.Order("sort_order asc, id asc").
		Limit(num).Offset(startIdx).
		Find(&items).Error
	return items, total, err
}

// GetResourceById 按主键取一条；不存在时返回 gorm.ErrRecordNotFound。
func GetResourceById(id int) (*Resource, error) {
	item := Resource{}
	if err := DB.First(&item, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

// GetResourceBySlug 按 slug 取一条；不存在时返回 gorm.ErrRecordNotFound。
func GetResourceBySlug(slug string) (*Resource, error) {
	item := Resource{}
	if err := DB.First(&item, "slug = ?", slug).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

// ResourceSlugExists 检查 slug 是否被别的条目占用（excludeId 用于更新时排除自身）。
func ResourceSlugExists(slug string, excludeId int) (bool, error) {
	query := DB.Model(&Resource{}).Where("slug = ?", slug)
	if excludeId > 0 {
		query = query.Where("id <> ?", excludeId)
	}
	var count int64
	if err := query.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// Insert 新建条目，时间戳由服务端统一写入。
func (resource *Resource) Insert() error {
	now := common.GetTimestamp()
	resource.CreatedAt = now
	resource.UpdatedAt = now
	return DB.Create(resource).Error
}

// Update 全量覆盖可编辑字段（Save 会把 false / 0 一起写回，避免零值被跳过）。
func (resource *Resource) Update() error {
	resource.UpdatedAt = common.GetTimestamp()
	return DB.Save(resource).Error
}

func (resource *Resource) Delete() error {
	return DB.Delete(&Resource{}, "id = ?", resource.Id).Error
}
