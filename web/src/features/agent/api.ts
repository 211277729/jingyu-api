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

import type {
  AgentCommission,
  AgentCustomer,
  AgentProfileData,
  AgentWithdrawal,
  Paged,
} from './types'

export async function getAgentProfile(): Promise<AgentProfileData> {
  const res = await api.get('/api/user/agent/profile')
  return requireServerSuccess(res.data)?.data as AgentProfileData
}

export async function applyAgent(contact: string, remark: string) {
  const res = await api.post('/api/user/agent/apply', { contact, remark })
  return requireServerSuccess(res.data)
}

export async function getAgentCommissions(page: number, pageSize: number) {
  const res = await api.get('/api/user/agent/commissions', {
    params: { p: page, page_size: pageSize },
  })
  return requireServerSuccess(res.data)?.data as Paged<AgentCommission>
}

export async function getAgentCustomers(page: number, pageSize: number) {
  const res = await api.get('/api/user/agent/customers', {
    params: { p: page, page_size: pageSize },
  })
  return requireServerSuccess(res.data)?.data as Paged<AgentCustomer>
}

export async function requestAgentWithdraw(amount: number) {
  const res = await api.post('/api/user/agent/withdraw', { amount })
  return requireServerSuccess(res.data)
}

export async function getAgentWithdrawals(page: number, pageSize: number) {
  const res = await api.get('/api/user/agent/withdrawals', {
    params: { p: page, page_size: pageSize },
  })
  return requireServerSuccess(res.data)?.data as Paged<AgentWithdrawal>
}
