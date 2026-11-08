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
export type GuardDecision = 1 | 2

export interface GuardDecisionCount {
  decision: GuardDecision
  count: number
}

export interface GuardUserStat {
  user_id: number
  username: string
  count: number
}

export interface GuardStats {
  today: GuardDecisionCount[]
  last_7_days: GuardDecisionCount[]
  top_users: GuardUserStat[]
  max_estimated_tokens: number
  max_body_bytes: number
  total_today: number
}

export interface GuardLogItem {
  id: number
  day: string
  user_id: number
  username: string
  token_name: string
  model: string
  endpoint: string
  body_bytes: number
  estimated_tokens: number
  max_tokens: number
  decision: GuardDecision
  created_at: number
}

export interface GetGuardLogsParams {
  decision?: GuardDecision | 0
  username?: string
  p?: number
  page_size?: number
}

export interface GetGuardLogsResponse {
  items: GuardLogItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface ApiEnvelope<T> {
  success: boolean
  message?: string
  data: T
}
