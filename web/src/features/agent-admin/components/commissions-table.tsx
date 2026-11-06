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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { getAgentCommissions } from '@/features/agent-admin/api'
import {
  EmptyRow,
  Pager,
  TableShell,
} from '@/features/agent-admin/components/table-kit'
import { formatDateTime } from '@/features/agent-admin/format'
import { formatQuota } from '@/lib/format'

const PAGE_SIZE = 10

/** 佣金明细查询：只读列表，可按代理用户 ID 过滤 */
export function CommissionsTable() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [agentUserId, setAgentUserId] = useState('')

  const query = useQuery({
    queryKey: ['agent-admin-commissions', page, agentUserId],
    queryFn: () =>
      getAgentCommissions({
        p: page,
        page_size: PAGE_SIZE,
        agent_user_id: Number(agentUserId) || undefined,
      }),
  })

  const items = query.data?.items ?? []

  return (
    <div className='space-y-3'>
      <Input
        className='w-52'
        type='number'
        min={0}
        placeholder={t('Filter by agent user ID')}
        value={agentUserId}
        onChange={(e) => {
          setAgentUserId(e.target.value)
          setPage(1)
        }}
      />
      <TableShell
        header={
          <>
            <th className='px-3 py-2 font-medium'>ID</th>
            <th className='px-3 py-2 font-medium'>{t('Agent')}</th>
            <th className='px-3 py-2 font-medium'>{t('Customer')}</th>
            <th className='px-3 py-2 font-medium'>{t('Level')}</th>
            <th className='px-3 py-2 font-medium'>{t('Trade No')}</th>
            <th className='px-3 py-2 font-medium'>{t('Top-up Amount')}</th>
            <th className='px-3 py-2 font-medium'>{t('Rate')}</th>
            <th className='px-3 py-2 font-medium'>{t('Commission')}</th>
            <th className='px-3 py-2 font-medium'>{t('Time')}</th>
          </>
        }
      >
        {items.map((item) => (
          <tr key={item.id} className='whitespace-nowrap'>
            <td className='px-3 py-2 text-xs tabular-nums'>{item.id}</td>
            <td className='px-3 py-2 font-medium'>#{item.agent_user_id}</td>
            <td className='px-3 py-2'>
              {item.payer_username || `#${item.payer_user_id}`}
            </td>
            <td className='px-3 py-2'>
              <Badge variant='outline'>
                {item.level === 2 ? t('Level 2') : t('Level 1')}
              </Badge>
            </td>
            <td className='text-muted-foreground max-w-40 truncate px-3 py-2 font-mono text-xs'>
              {item.trade_no ||
                (item.redemption_id ? `R-${item.redemption_id}` : '-')}
            </td>
            <td className='px-3 py-2 tabular-nums'>
              {formatQuota(item.credited_quota)}
            </td>
            <td className='px-3 py-2 tabular-nums'>{item.percent}%</td>
            <td className='px-3 py-2 font-semibold text-emerald-600 tabular-nums dark:text-emerald-400'>
              +{formatQuota(item.commission_quota)}
            </td>
            <td className='px-3 py-2 text-xs tabular-nums'>
              {formatDateTime(item.created_at)}
            </td>
          </tr>
        ))}
        {items.length === 0 ? <EmptyRow colSpan={9} /> : null}
      </TableShell>
      <Pager
        page={page}
        pageSize={PAGE_SIZE}
        total={query.data?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  )
}
