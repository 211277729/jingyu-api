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
// 公开页面的 SEO 文案与 head 资产：TanStack Router 的 head() 配合根路由的
// <HeadContent /> 把 title/description/OG/canonical/JSON-LD 渲染进 <head>。
// 文案不过 i18n——爬虫读到的固定标题比按语言切换更稳定，与 i18n 裁剪约定
// （只维护 en+zh）无冲突。

export interface PublicPageMeta {
  title: string
  description: string
}

// 站点公开域名：canonical/OG/JSON-LD 的 URL 都要绝对地址。与 robots.txt
// 的 Sitemap 行共用同一个域名事实源；换域名时两处同步改。
export const SITE_URL = 'https://jingyuai.xiaoyuji.cn'
export const SITE_NAME = '鲸鱼 API'
// og:image 先用方版 logo 兜底（512×512），后续补 1200×630 专属图
export const OG_IMAGE_PATH = '/logo.png'

// 公开页面文案清单，sitemap.xml 里的固定页面与这里一一对应（后端
// controller/sitemap.go 的 sitemapStaticPaths），新增公开页面两处都要加。
export const PUBLIC_PAGE_META = {
  home: {
    title: '鲸鱼 API - 统一的大模型 API 接口服务',
    path: '/',
    description:
      '鲸鱼 API 提供统一的大模型 API 接口服务：一个密钥调用 GPT、Claude、Gemini、DeepSeek 等主流模型，按量计费、开箱即用。',
  },
  nav: {
    title: 'AI 导航 - 鲸鱼 API',
    path: '/nav',
    description:
      '精选 AI 工具与站点导航：模型官网、开发框架、效率工具分类收录，持续维护可用性。',
  },
  pricing: {
    title: '模型定价 - 鲸鱼 API',
    path: '/pricing',
    description:
      '实时大模型 API 价格与倍率：按模型查看输入输出单价、分组倍率与官方价对比。',
  },
  pricingModel: {
    title: '模型详情 - 大模型 API 价格与倍率 - 鲸鱼 API',
    path: '', // 动态路由，canonical 由组件按实际 slug 拼
    description: '查看单个大模型的 API 定价：输入输出单价、倍率与计费说明。',
  },
  freeModels: {
    title: '免费大模型 API 汇总 - 免费额度模型列表 - 鲸鱼 API',
    path: '/pricing/free',
    description:
      '鲸鱼 API 免费模型专区：免费调用 GPT、Claude、DeepSeek、Qwen 等大模型 API，0 元模型与免费分组长期开放，注册即用。',
  },
  rankings: {
    title: '模型排行榜 - 鲸鱼 API',
    path: '/rankings',
    description: '大模型 API 调用量排行榜：看看站内用户最常用的模型有哪些。',
  },
  resources: {
    title: '资源广场 - MCP / Skills / Agent 工具 - 鲸鱼 API',
    path: '/resources',
    description:
      '收录可直接接入的 MCP 服务、Claude Skills 与 Agent 工具：结构化配置一键复制，按分类与标签浏览。',
  },
  resourceDetail: {
    title: '资源详情 - 鲸鱼 API',
    path: '', // 动态路由，canonical 由组件按实际 slug 拼
    description: '查看 MCP 服务、Skills 或 Agent 工具的详细介绍与接入配置。',
  },
  docs: {
    title: '使用文档 - 鲸鱼 API',
    path: '/docs',
    description: '鲸鱼 API 使用文档：密钥管理、接口调用、计费说明与常见问题。',
  },
  about: {
    title: '关于我们 - 鲸鱼 API',
    path: '/about',
    description: '了解鲸鱼 API：服务介绍、联系方式与团队信息。',
  },
  agentProgram: {
    title: '代理分销计划 - 鲸鱼 API',
    path: '/agent-program',
    description:
      '加入鲸鱼 API 代理分销计划：邀请充值获得返利，分档结算，提现灵活。',
  },
} satisfies Record<string, PublicPageMeta>

// createPublicHead 生成路由 head：title/description + OG/twitter card +
// canonical。canonical 固定用无参数的干净 URL——pricing 等带筛选查询串的
// 页面，每个参数组合都是不同地址，会让搜索引擎当成重复页分散权重。
// 动态路由（path 为空串）不生成 canonical，由组件级 head 补。
export function createPublicHead(meta: PublicPageMeta) {
  const head: {
    meta: Array<Record<string, string>>
    links?: Array<Record<string, string>>
  } = {
    meta: [
      { title: meta.title },
      { name: 'description', content: meta.description },
      { property: 'og:title', content: meta.title },
      { property: 'og:description', content: meta.description },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: SITE_URL + OG_IMAGE_PATH },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: meta.title },
      { name: 'twitter:description', content: meta.description },
    ],
  }
  if (meta.path) {
    head.links = [{ rel: 'canonical', href: SITE_URL + meta.path }]
    head.meta.push({ property: 'og:url', content: SITE_URL + meta.path })
  }
  return head
}

// createNotFoundHead 给详情页数据不存在（软 404）的分支用：robots noindex
// 告诉搜索引擎不要收录这个地址，同时清掉页面级 title/description，
// 避免不存在的模型/资源带着正常文案进入索引。
export function createNotFoundHead() {
  return {
    meta: [
      { title: `页面不存在 - ${SITE_NAME}` },
      { name: 'robots', content: 'noindex, follow' },
    ],
  }
}

// buildSiteJsonLd 生成全站结构化数据：Organization + WebSite（含站内搜索
// 的 SearchAction，让 Google 知道站点有搜索框）。挂在根路由 head 上，
// 子路由不用重复输出。
export function buildSiteJsonLd(): Array<Record<string, unknown>> {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: SITE_URL + OG_IMAGE_PATH,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: SITE_URL + '/pricing?search={search_term_string}',
        },
        'query-input': 'required name=search_term_string',
      },
    },
  ]
}

// buildModelJsonLd 给定价模型详情页用：把输入/输出单价输出成 Product/Offer，
// 「模型名 + 价格」的搜索结果有机会出现价格富摘要。priceUnitPrice 说明：
// ratio 1 = $2/1M tokens（见 features/pricing/lib/price.ts 的换算口径），
// 价格按分组最小倍率折算成美元；分页签位用下方字段拼。
export function buildModelJsonLd(params: {
  modelName: string
  usdInputPerMillion: number
  usdOutputPerMillion: number
  canonicalPath: string
}): Record<string, unknown> {
  const price = params.usdInputPerMillion
    .toFixed(params.usdInputPerMillion < 0.01 ? 6 : 4)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: params.modelName,
    url: SITE_URL + params.canonicalPath,
    brand: { '@type': 'Brand', name: SITE_NAME },
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: 'USD',
      url: SITE_URL + params.canonicalPath,
      description: `Input $${price} per 1M tokens; output $${params.usdOutputPerMillion} per 1M tokens on ${SITE_NAME}.`,
    },
  }
}
