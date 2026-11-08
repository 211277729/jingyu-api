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
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import type { ResourceApiItem, ResourceItem } from './types'

/** 资源广场的唯一查询键：后台改完条目 invalidate 它即可刷新前台。 */
export const RESOURCES_QUERY_KEY = ['resources', 'public-list'] as const

const RESOURCES_STALE_TIME = 5 * 60 * 1000

/** 后端条目 → 前台条目：空串转 undefined，其余字段名对齐前端驼峰。 */
export function toResourceItem(row: ResourceApiItem): ResourceItem {
  return {
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    iconName: row.icon_name || undefined,
    vendor: row.vendor,
    tags: row.tags ?? [],
    summary: {
      zh: row.summary?.zh ?? '',
      en: row.summary?.en ?? '',
    },
    description: {
      zh: row.description?.zh ?? '',
      en: row.description?.en ?? '',
    },
    highlights: {
      zh: row.highlights?.zh ?? [],
      en: row.highlights?.en ?? [],
    },
    mcp: row.mcp,
    content: row.content || undefined,
    installCommand: row.install_command || undefined,
    downloadUrl: row.download_url || undefined,
    repoUrl: row.repo_url || undefined,
  }
}

/** 拉取已上架的条目；接口失败时抛出带 message 的错误，由页面呈现错误态。 */
export async function fetchResources(): Promise<ResourceItem[]> {
  const response = await api.get('/api/resource/list')
  const body = requireServerSuccess(response.data) as {
    data?: { items?: ResourceApiItem[] }
  }
  return (body.data?.items ?? []).map(toResourceItem)
}

/** 资源广场数据的统一入口（index 与 detail 共用同一份缓存）。 */
export function useResourcesQuery() {
  return useQuery({
    queryKey: RESOURCES_QUERY_KEY,
    queryFn: fetchResources,
    staleTime: RESOURCES_STALE_TIME,
  })
}
