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
import { api } from '@/lib/api'

import type {
  GetDailyVisitsParams,
  GetDailyVisitsResponse,
  GetVisitDetailParams,
  GetVisitDetailResponse,
} from './types'

/**
 * 管理员查询日期范围内的访客汇总（含构成统计），范围默认当天
 */
export async function getDailyVisits(
  params: GetDailyVisitsParams
): Promise<GetDailyVisitsResponse> {
  const { start_date, end_date, p = 1, page_size = 10 } = params
  const res = await api.get('/api/visit/daily', {
    params: { start_date, end_date, p, page_size },
  })
  return res.data
}

/**
 * 管理员下钻某位访客在日期范围内的导航明细
 */
export async function getVisitDetail(
  params: GetVisitDetailParams
): Promise<GetVisitDetailResponse> {
  const { start_date, end_date, user_id, ip, p = 1, page_size = 20 } = params
  const res = await api.get('/api/visit/detail', {
    params: { start_date, end_date, user_id, ip, p, page_size },
  })
  return res.data
}
