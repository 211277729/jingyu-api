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
import type {
  LocalizedList,
  LocalizedText,
  McpServerSpec,
  ResourceKind,
} from '@/features/resources/types'

/** 后台条目：公开字段 + 启用状态与时间戳（与 /api/resource/admin/list 对应） */
export type ResourceAdminItem = {
  id: number
  slug: string
  name: string
  kind: ResourceKind
  icon_name: string
  vendor: 'Official' | 'Community'
  tags: string[]
  summary: LocalizedText
  description: LocalizedText
  highlights: LocalizedList
  mcp?: McpServerSpec
  /** Markdown 正文：详情页原样渲染 */
  content: string
  install_command: string
  download_url: string
  repo_url: string
  sort_order: number
  enabled: boolean
  created_at: number
  updated_at: number
}

export type ResourceListParams = {
  p?: number
  page_size?: number
  keyword?: string
  kind?: string
  enabled?: string
}

/** 新建 / 更新请求体：双语拆开提交，JSON 列由服务端拼装 */
export type ResourcePayload = {
  id?: number
  slug: string
  name: string
  kind: ResourceKind
  icon_name: string
  vendor: 'Official' | 'Community'
  tags: string[]
  summary_zh: string
  summary_en: string
  description_zh: string
  description_en: string
  highlights_zh: string[]
  highlights_en: string[]
  mcp?: McpServerSpec
  content: string
  install_command: string
  download_url: string
  repo_url: string
  sort_order: number
  enabled: boolean
}

/** 表单内部形状：多值字段先用文本收集，提交时再切分 */
export type ResourceFormValues = {
  slug: string
  name: string
  kind: ResourceKind
  vendor: 'Official' | 'Community'
  icon_name: string
  tags: string
  summary_zh: string
  summary_en: string
  description_zh: string
  description_en: string
  highlights_zh: string
  highlights_en: string
  mcp_name: string
  mcp_command: string
  mcp_args: string
  mcp_env: string
  content: string
  install_command: string
  download_url: string
  repo_url: string
  sort_order: number
  enabled: boolean
}

export type ResourcesDialogType = 'create' | 'edit' | 'delete'
