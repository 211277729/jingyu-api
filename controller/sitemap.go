package controller

import (
	"encoding/xml"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

// sitemap 固定收录的公开页面清单。这些路由全部由 SPA 前端渲染，服务端
// 无法从数据库推导它们的列表，只能在这里维护；新增公开页面时记得补一行。
var sitemapStaticPaths = []struct {
	Path       string
	ChangeFreq string
	Priority   string
}{
	{Path: "/", ChangeFreq: "daily", Priority: "1.0"},
	{Path: "/nav", ChangeFreq: "weekly", Priority: "0.9"},
	{Path: "/pricing", ChangeFreq: "daily", Priority: "0.9"},
	{Path: "/rankings", ChangeFreq: "daily", Priority: "0.8"},
	{Path: "/resources", ChangeFreq: "weekly", Priority: "0.9"},
	{Path: "/docs", ChangeFreq: "monthly", Priority: "0.7"},
	{Path: "/about", ChangeFreq: "monthly", Priority: "0.5"},
	{Path: "/agent-program", ChangeFreq: "monthly", Priority: "0.6"},
}

// sitemapURL 是 sitemap 协议里的一条 <url>。loc 是必填项，其余都可以留空，
// 留空的字段在输出时用omitempty 跳过，避免生成 <lastmod></lastmod> 这类空标签。
type sitemapURL struct {	Loc        string `xml:"loc"`
	LastMod    string `xml:"lastmod,omitempty"`
	ChangeFreq string `xml:"changefreq,omitempty"`
	Priority   string `xml:"priority,omitempty"`
}

// sitemapURLSet 是整个 sitemap 文档的根，xmlns 固定为 sitemap 协议 0.9。
type sitemapURLSet struct {
	XMLName xml.Name     `xml:"urlset"`
	Xmlns   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL `xml:"url"`
}

// GetSitemap 输出 /sitemap.xml。搜索引擎靠它发现 SPA 的页面清单——前端
// 所有路由共享同一份 index.html，爬虫无法通过页面链接遍历出全部路由。
// 域名取系统设置里的 ServerAddress；资源详情来自 resources 表，定价模型
// 详情来自 abilities 表。查询失败时降级为只输出固定页面，不让站点地图
// 整体不可用。
func GetSitemap(c *gin.Context) {
	base := strings.TrimRight(system_setting.ServerAddress, "/")

	now := time.Now().Format("2006-01-02")
	urls := make([]sitemapURL, 0, len(sitemapStaticPaths)+16)
	for _, page := range sitemapStaticPaths {
		urls = append(urls, sitemapURL{
			Loc:        base + page.Path,
			LastMod:    now,
			ChangeFreq: page.ChangeFreq,
			Priority:   page.Priority,
		})
	}

	resources, err := model.GetEnabledResources()
	if err != nil {
		common.SysError("GetSitemap: load resources failed: " + err.Error())
	} else {
		for _, resource := range resources {
			if resource.Slug == "" {
				continue
			}
			urls = append(urls, sitemapURL{
				Loc:     base + "/resources/" + url.PathEscape(resource.Slug),
				LastMod: time.Unix(resource.UpdatedAt, 0).Format("2006-01-02"),
			})
		}
	}

	// 模型名可能含 "/" 或 "."（如 deepseek-ai/deepseek-v3），必须逐段转义
	// 才能作为 URL 的最后一段出现；定价页不按模型记修改时间，不给 lastmod。
	for _, modelName := range model.GetEnabledModels() {
		if modelName == "" {
			continue
		}
		urls = append(urls, sitemapURL{
			Loc: base + "/pricing/" + url.PathEscape(modelName),
		})
	}

	doc := sitemapURLSet{Xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9", URLs: urls}
	body, err := xml.MarshalIndent(doc, "", "  ")
	if err != nil {
		common.SysError("GetSitemap: marshal failed: " + err.Error())
		c.Data(500, "text/plain; charset=utf-8", []byte("sitemap marshal failed"))
		return
	}
	// xml.Encoder 的头不经过 MarshalIndent，这里手动补上 XML 声明。
	body = append([]byte(xml.Header), body...)

	c.Header("Cache-Control", "public, max-age=3600")
	c.Data(200, "application/xml; charset=utf-8", body)
}
