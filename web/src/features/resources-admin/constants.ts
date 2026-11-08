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
import type { ResourceKind } from '@/features/resources/types'

import type { ResourceFormValues } from './types'

/** 类别下拉：value 与后端枚举一致，label 走 i18n key */
export const RESOURCE_KIND_OPTIONS: {
  value: ResourceKind
  labelKey: string
}[] = [
  { value: 'mcp', labelKey: 'MCP Servers' },
  { value: 'skill', labelKey: 'Agent Skills' },
  { value: 'agent-tool', labelKey: 'Agent Tools' },
]

/** 来源下拉 */
export const RESOURCE_VENDOR_OPTIONS: {
  value: 'Official' | 'Community'
  labelKey: string
}[] = [
  { value: 'Official', labelKey: 'Official' },
  { value: 'Community', labelKey: 'Community' },
]

/** 启用状态筛选：all 表示不筛选 */
export const RESOURCE_ENABLED_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'all', labelKey: 'All' },
  { value: 'true', labelKey: 'Enabled' },
  { value: 'false', labelKey: 'Disabled' },
]

/** 与后端 controller/resource.go 的常量保持一致 */
export const RESOURCE_LIMITS = {
  slugMaxLen: 64,
  nameMaxLen: 128,
  tagMaxCount: 20,
  highlightMax: 12,
  highlightMaxLen: 200,
  urlMaxLen: 512,
  sortOrderMax: 99999,
} as const

/** 新建条目的默认值：kind 先给 mcp，避免空表单长得像"什么都没有" */
export const RESOURCE_FORM_DEFAULT_VALUES: ResourceFormValues = {
  slug: '',
  name: '',
  kind: 'mcp',
  vendor: 'Official',
  icon_name: '',
  tags: '',
  summary_zh: '',
  summary_en: '',
  description_zh: '',
  description_en: '',
  highlights_zh: '',
  highlights_en: '',
  mcp_name: '',
  mcp_command: '',
  mcp_args: '',
  mcp_env: '',
  content: '',
  install_command: '',
  download_url: '',
  repo_url: '',
  sort_order: 0,
  enabled: true,
}
