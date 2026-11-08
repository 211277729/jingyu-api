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
import type { QueryClient } from '@tanstack/react-query'

import { RESOURCES_QUERY_KEY } from '@/features/resources/api'
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import type {
  ResourceAdminItem,
  ResourceListParams,
  ResourcePayload,
} from './types'

/** 后台分页查询资源条目（含未启用），支持关键字 / 类别 / 启用状态筛选 */
export async function getResources(
  params: ResourceListParams
): Promise<{ items: ResourceAdminItem[]; total: number }> {
  const { p = 1, page_size = 20, keyword, kind, enabled } = params
  const response = await api.get('/api/resource/admin/list', {
    params: { p, page_size, keyword, kind, enabled },
  })
  const body = requireServerSuccess(response.data) as {
    data?: { items?: ResourceAdminItem[]; total?: number }
  }
  return {
    items: body.data?.items ?? [],
    total: body.data?.total ?? 0,
  }
}

/** 新建条目 */
export async function createResource(
  payload: ResourcePayload
): Promise<ResourceAdminItem> {
  const response = await api.post('/api/resource/admin/', payload)
  return requireServerSuccess(response.data).data as ResourceAdminItem
}

/** 全量更新条目（id 在 body 里） */
export async function updateResource(
  payload: ResourcePayload
): Promise<ResourceAdminItem> {
  const response = await api.put('/api/resource/admin/', payload)
  return requireServerSuccess(response.data).data as ResourceAdminItem
}

/** 删除条目 */
export async function deleteResource(id: number): Promise<void> {
  const response = await api.delete(`/api/resource/admin/${id}`)
  requireServerSuccess(response.data)
}

/** 后台改动后让前台广场缓存立刻失效，避免管理员回前台看到旧数据 */
export function invalidatePublicResources(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: RESOURCES_QUERY_KEY })
}
