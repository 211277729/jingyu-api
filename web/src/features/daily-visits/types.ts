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
// ============================================================================
// Daily Visits Types
// ============================================================================

/** 陌生 IP 归属地（由后端缓存读回，未查询为 null） */
export interface IpGeoInfo {
  ip: string
  country: string
  region: string
  city: string
  isp: string
  source: string
  updated_at: number
}

/** 每天每位访客（登录用户或匿名 IP）一行的汇总 */
export interface VisitSummaryItem {
  visit_count: number
  first_visit_at: number
  last_visit_at: number
  user_id: number
  username: string
  ip: string
  is_anonymous: boolean
  is_new_user: boolean
  user_created_at: number
  ip_geo?: IpGeoInfo | null
}

/** 一天的访客构成统计 */
export interface VisitDailyStats {
  total_visitors: number
  logged_in: number
  anonymous: number
  new_users: number
}

export interface GetDailyVisitsParams {
  start_date?: string
  end_date?: string
  p?: number
  page_size?: number
}

export interface GetDailyVisitsResponse {
  success: boolean
  message?: string
  data?: {
    page: number
    page_size: number
    total: number
    items: VisitSummaryItem[]
    stats: VisitDailyStats
  }
}

/** 一次页面导航的明细记录 */
export interface VisitDetailItem {
  id: number
  day: string
  user_id: number
  username: string
  ip: string
  path: string
  created_at: number
}

export interface GetVisitDetailParams {
  start_date?: string
  end_date?: string
  user_id?: number
  ip?: string
  p?: number
  page_size?: number
}

export interface GetVisitDetailResponse {
  success: boolean
  message?: string
  data?: {
    page: number
    page_size: number
    total: number
    items: VisitDetailItem[]
  }
}

/** 明细弹窗的目标访客：登录用户按 user_id，匿名按 ip */
export interface VisitDetailTarget {
  userId: number
  ip: string
  label: string
}
