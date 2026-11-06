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

/** 代理档案状态 */
export type AgentProfileStatus =
  | 'none'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'disabled'

export interface AgentProfile {
  id: number
  user_id: number
  status: Exclude<AgentProfileStatus, 'none'>
  tier: number
  contact: string
  remark: string
  first_percent: number
  percent: number
  applied_at: number
  reviewed_at: number
  reviewed_by: number
}

/** GET /api/user/agent/profile 响应 */
export interface AgentProfileData {
  enabled: boolean
  status: AgentProfileStatus
  agent_quota: number
  agent_history_quota: number
  first_percent: number
  percent: number
  second_percent: number
  min_withdraw_quota: number
  profile?: AgentProfile
}

export interface AgentCommission {
  id: number
  agent_user_id: number
  payer_user_id: number
  payer_username: string
  level: number
  topup_id: number
  redemption_id: number
  trade_no: string
  credited_quota: number
  percent: number
  commission_quota: number
  created_at: number
}

export interface AgentCustomer {
  user_id: number
  username: string
  display_name: string
  created_at: number
  total_commission: number
}

export type AgentWithdrawalStatus = 'pending' | 'approved' | 'paid' | 'rejected'

export interface AgentWithdrawal {
  id: number
  user_id: number
  username?: string
  amount: number
  status: AgentWithdrawalStatus
  remark: string
  applied_at: number
  reviewed_at: number
  paid_at: number
}

/** 后端 PageInfo 统一分页响应 */
export interface Paged<T> {
  page: number
  page_size: number
  total: number
  items: T[]
}
