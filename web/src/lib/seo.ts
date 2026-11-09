/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
// 公开页面的 SEO 文案：纯 SPA 下搜索引擎只能读到路由 head 渲染出的
// title/description，这里是各公开页面的固定文案；登录后的页面不参与
// 收录，不需要 head。文案不过 i18n——爬虫读到的固定标题比按语言切换
// 更稳定，与 i18n 裁剪约定（只维护 en+zh）无冲突。

export interface PublicPageMeta {
  title: string
  description: string
}

// createPublicHead 生成 TanStack Router 路由选项 head 需要的 meta 数组。
// 用法：head: () => createPublicHead(PAGES.home)
export function createPublicHead(meta: PublicPageMeta) {
  return {
    meta: [
      { title: meta.title },
      { name: 'description', content: meta.description },
    ],
  }
}

// 公开页面文案清单，sitemap.xml 里的固定页面与这里一一对应（后端
// controller/sitemap.go 的 sitemapStaticPaths），新增公开页面两处都要加。
export const PUBLIC_PAGE_META = {
  home: {
    title: '鲸鱼 API - 统一的大模型 API 接口服务',
    description:
      '鲸鱼 API 提供统一的大模型 API 接口服务：一个密钥调用 GPT、Claude、Gemini、DeepSeek 等主流模型，按量计费、开箱即用。',
  },
  nav: {
    title: 'AI 导航 - 鲸鱼 API',
    description:
      '精选 AI 工具与站点导航：模型官网、开发框架、效率工具分类收录，持续维护可用性。',
  },
  pricing: {
    title: '模型定价 - 鲸鱼 API',
    description:
      '实时大模型 API 价格与倍率：按模型查看输入输出单价、分组倍率与官方价对比。',
  },
  pricingModel: {
    title: '模型详情 - 大模型 API 价格与倍率 - 鲸鱼 API',
    description: '查看单个大模型的 API 定价：输入输出单价、倍率与计费说明。',
  },
  freeModels: {
    title: '免费大模型 API 汇总 - 免费额度模型列表 - 鲸鱼 API',
    description:
      '鲸鱼 API 免费模型专区：免费调用 GPT、Claude、DeepSeek、Qwen 等大模型 API，0 元模型与免费分组长期开放，注册即用。',
  },
  rankings: {
    title: '模型排行榜 - 鲸鱼 API',
    description: '大模型 API 调用量排行榜：看看站内用户最常用的模型有哪些。',
  },
  resources: {
    title: '资源广场 - MCP / Skills / Agent 工具 - 鲸鱼 API',
    description:
      '收录可直接接入的 MCP 服务、Claude Skills 与 Agent 工具：结构化配置一键复制，按分类与标签浏览。',
  },
  resourceDetail: {
    title: '资源详情 - 鲸鱼 API',
    description: '查看 MCP 服务、Skills 或 Agent 工具的详细介绍与接入配置。',
  },
  docs: {
    title: '使用文档 - 鲸鱼 API',
    description: '鲸鱼 API 使用文档：密钥管理、接口调用、计费说明与常见问题。',
  },
  about: {
    title: '关于我们 - 鲸鱼 API',
    description: '了解鲸鱼 API：服务介绍、联系方式与团队信息。',
  },
  agentProgram: {
    title: '代理分销计划 - 鲸鱼 API',
    description:
      '加入鲸鱼 API 代理分销计划：邀请充值获得返利，分档结算，提现灵活。',
  },
} satisfies Record<string, PublicPageMeta>
