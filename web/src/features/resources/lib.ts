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
import { buildDefaultMcpSnippet } from './mcp'
import type {
  LocalizedList,
  LocalizedText,
  ResourceItem,
  ResourceKind,
} from './types'

/**
 * 按站点语言取双语文案。zh 覆盖简繁两种中文，其余一律英文，
 * 与 i18n 里"只有 en/zh/zh-TW 被注册"的口径一致。
 */
export function pickLocalized(text: LocalizedText, language: string): string {
  return language.toLowerCase().startsWith('zh') ? text.zh : text.en
}

/** 同上，作用于亮点列表 */
export function pickLocalizedList(
  list: LocalizedList,
  language: string
): string[] {
  return language.toLowerCase().startsWith('zh') ? list.zh : list.en
}

/** 广场顶部的类别 Tab；labelKey 为 i18n key */
export const RESOURCE_KIND_TABS: {
  id: 'all' | ResourceKind
  labelKey: string
}[] = [
  { id: 'all', labelKey: 'All' },
  { id: 'mcp', labelKey: 'MCP Servers' },
  { id: 'skill', labelKey: 'Agent Skills' },
  { id: 'agent-tool', labelKey: 'Agent Tools' },
]

/** 类别 → 视觉标识色（固定色相，浅深主题同形） */
export const KIND_STYLES: Record<
  ResourceKind,
  { badge: string; chip: string }
> = {
  mcp: {
    badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
    chip: 'from-violet-500/25 to-violet-500/5',
  },
  skill: {
    badge: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300',
    chip: 'from-cyan-500/25 to-cyan-500/5',
  },
  'agent-tool': {
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
    chip: 'from-amber-500/25 to-amber-500/5',
  },
}

/**
 * 接口还没返回时的稳定空数组。
 * 直接写 `data ?? []` 会让每次渲染都产生新引用，依赖它的 useMemo 白算一遍。
 */
export const EMPTY_RESOURCES: ResourceItem[] = []

/** 在已加载的条目里按 slug 找详情；数据来自后端接口，找不到由页面呈现空态。 */
export function findResourceBySlug(
  items: ResourceItem[],
  slug: string
): ResourceItem | undefined {
  return items.find((item) => item.slug === slug)
}

/** 卡片快捷复制用的片段：MCP 取默认客户端写法，其余直接取安装命令 */
export function getQuickInstall(item: ResourceItem): string | undefined {
  return item.mcp ? buildDefaultMcpSnippet(item.mcp) : item.installCommand
}

/** 类别 + 关键字过滤，关键字命中名称、slug、标签与简介。 */
export function filterResources(
  items: ResourceItem[],
  kind: 'all' | ResourceKind,
  query: string
): ResourceItem[] {
  const needle = query.trim().toLowerCase()
  return items.filter((item) => {
    if (kind !== 'all' && item.kind !== kind) return false
    if (!needle) return true
    const haystack = [
      item.name,
      item.slug,
      ...item.tags,
      item.summary.zh,
      item.summary.en,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(needle)
  })
}
