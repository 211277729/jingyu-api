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
import { requireServerSuccess } from '@/lib/server-error-message'

import type { AgentCommission, AgentProfile, AgentWithdrawal, Paged } from '@/features/agent/types'

export interface AgentProfileView extends AgentProfile {
  username: string
  display_name: string
}

export interface AgentWithdrawalView extends AgentWithdrawal {
  username: string
}

export async function getAgentProfiles(params: {
  p: number
  page_size: number
  status?: string
  keyword?: string
}) {
  const res = await api.get('/api/user/agent/admin/profiles', { params })
  return requireServerSuccess(res.data)?.data as Paged<AgentProfileView>
}

export async function reviewAgentProfile(payload: {
  id: number
  status: 'approved' | 'rejected' | 'disabled'
  tier?: number
  first_percent?: number
  percent?: number
  remark?: string
}) {
  const res = await api.post('/api/user/agent/admin/profiles/review', payload)
  return requireServerSuccess(res.data)
}

/** 删除代理档案：删除后该用户可重新申请（区别于禁用）；佣金余额保留 */
export async function deleteAgentProfile(id: number) {
  const res = await api.post('/api/user/agent/admin/profiles/delete', { id })
  return requireServerSuccess(res.data)
}

export async function adjustAgentQuota(payload: {
  user_id: number
  quota: number
  remark?: string
}) {
  const res = await api.post('/api/user/agent/admin/adjust-quota', payload)
  return requireServerSuccess(res.data)
}

export async function getAgentWithdrawals(params: {
  p: number
  page_size: number
  status?: string
}) {
  const res = await api.get('/api/user/agent/admin/withdrawals', { params })
  return requireServerSuccess(res.data)?.data as Paged<AgentWithdrawalView>
}

export async function reviewAgentWithdrawal(payload: {
  id: number
  action: 'approve' | 'pay' | 'reject'
  remark?: string
}) {
  const res = await api.post('/api/user/agent/admin/withdrawals/review', payload)
  return requireServerSuccess(res.data)
}

export async function getAgentCommissions(params: {
  p: number
  page_size: number
  agent_user_id?: number
}) {
  const res = await api.get('/api/user/agent/admin/commissions', { params })
  return requireServerSuccess(res.data)?.data as Paged<AgentCommission>
}

export async function bindAgentCustomer(payload: {
  user_id: number
  agent_user_id: number
}) {
  const res = await api.post('/api/user/agent/admin/bind-customer', payload)
  return requireServerSuccess(res.data)
}
