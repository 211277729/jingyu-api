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
import { BanknoteArrowUp, Check } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog } from '@/components/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { formatQuota } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'

import {
  type AgentWithdrawalView,
  getAgentWithdrawals,
  reviewAgentWithdrawal,
} from '../api'
import { formatDateTime } from '../format'
import { EmptyRow, Pager, TableShell } from './table-kit'

const PAGE_SIZE = 10

const STATUS_BADGE: Record<string, { labelKey: string; className: string }> = {
  pending: {
    labelKey: 'Under review',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  approved: {
    labelKey: 'Awaiting payout',
    className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  },
  paid: {
    labelKey: 'Paid',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  rejected: {
    labelKey: 'Rejected',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400',
  },
}

/**
 * 提现审核：approve（通过，额度申请时已冻结）→ pay（线下红包发放后标记）/
 * reject（拒绝并退还冻结额度）。
 */
export function WithdrawalsTable() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [payTarget, setPayTarget] = useState<AgentWithdrawalView | null>(null)
  const [payRemark, setPayRemark] = useState('')
  const [rejectTarget, setRejectTarget] = useState<AgentWithdrawalView | null>(
    null
  )
  const [approveTarget, setApproveTarget] =
    useState<AgentWithdrawalView | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const query = useQuery({
    queryKey: ['agent-admin-withdrawals', page, statusFilter],
    queryFn: () =>
      getAgentWithdrawals({
        p: page,
        page_size: PAGE_SIZE,
        status: statusFilter || undefined,
      }),
  })

  const submitReview = async (
    withdrawal: AgentWithdrawalView,
    action: 'approve' | 'pay' | 'reject',
    remark = ''
  ) => {
    setActionLoading(true)
    try {
      await reviewAgentWithdrawal({ id: withdrawal.id, action, remark })
      toast.success(t('Saved'))
      setPayTarget(null)
      setRejectTarget(null)
      setApproveTarget(null)
      setPayRemark('')
      void query.refetch()
    } catch (error) {
      handleServerError(error, t('Failed to save'))
    } finally {
      setActionLoading(false)
    }
  }

  const items = query.data?.items ?? []

  return (
    <div className='space-y-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <NativeSelect
          className='w-44'
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value=''>{t('All statuses')}</option>
          <option value='pending'>{t('Under review')}</option>
          <option value='approved'>{t('Awaiting payout')}</option>
          <option value='paid'>{t('Paid')}</option>
          <option value='rejected'>{t('Rejected')}</option>
        </NativeSelect>
      </div>

      <TableShell
        header={
          <>
            <th className='px-3 py-2 font-medium'>ID</th>
            <th className='px-3 py-2 font-medium'>{t('User')}</th>
            <th className='px-3 py-2 font-medium'>{t('Amount')}</th>
            <th className='px-3 py-2 font-medium'>{t('Status')}</th>
            <th className='px-3 py-2 font-medium'>{t('Applied At')}</th>
            <th className='px-3 py-2 font-medium'>{t('Remark')}</th>
            <th className='px-3 py-2 font-medium'>{t('Actions')}</th>
          </>
        }
      >
        {items.map((item) => (
          <tr key={item.id} className='whitespace-nowrap'>
            <td className='px-3 py-2 text-xs tabular-nums'>{item.id}</td>
            <td className='px-3 py-2 font-medium'>
              {item.username}
              <span className='text-muted-foreground ml-1.5 text-xs'>
                (#{item.user_id})
              </span>
            </td>
            <td className='px-3 py-2 font-semibold tabular-nums'>
              {formatQuota(item.amount)}
            </td>
            <td className='px-3 py-2'>
              <Badge
                variant='outline'
                className={STATUS_BADGE[item.status]?.className}
              >
                {t(STATUS_BADGE[item.status]?.labelKey ?? item.status)}
              </Badge>
            </td>
            <td className='px-3 py-2 text-xs tabular-nums'>
              {formatDateTime(item.applied_at)}
            </td>
            <td className='text-muted-foreground max-w-44 truncate px-3 py-2 text-xs'>
              {item.remark || '-'}
            </td>
            <td className='px-3 py-2'>
              <div className='flex items-center gap-1'>
                {item.status === 'pending' ? (
                  <Button
                    size='sm'
                    variant='outline'
                    className='h-7 text-xs'
                    onClick={() => setApproveTarget(item)}
                  >
                    <Check className='size-3.5' />
                    {t('Approve')}
                  </Button>
                ) : null}
                {item.status === 'approved' ? (
                  <>
                    <Button
                      size='sm'
                      variant='outline'
                      className='h-7 text-xs'
                      onClick={() => {
                        setPayTarget(item)
                        setPayRemark('')
                      }}
                    >
                      <BanknoteArrowUp className='size-3.5' />
                      {t('Mark as paid')}
                    </Button>
                    <Button
                      size='sm'
                      variant='outline'
                      className='text-destructive h-7 text-xs'
                      onClick={() => setRejectTarget(item)}
                    >
                      {t('Reject')}
                    </Button>
                  </>
                ) : null}
              </div>
            </td>
          </tr>
        ))}
        {items.length === 0 ? <EmptyRow colSpan={7} /> : null}
      </TableShell>
      <Pager
        page={page}
        pageSize={PAGE_SIZE}
        total={query.data?.total ?? 0}
        onPageChange={setPage}
      />

      <ConfirmDialog
        open={approveTarget !== null}
        onOpenChange={(open) => {
          if (!open) setApproveTarget(null)
        }}
        title={t('Approve Withdrawal')}
        desc={t(
          'Approve this withdrawal? The frozen commission stays deducted until you mark it paid.'
        )}
        isLoading={actionLoading}
        handleConfirm={() =>
          approveTarget && submitReview(approveTarget, 'approve')
        }
      />

      <Dialog
        open={payTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPayTarget(null)
        }}
        title={t('Mark as paid')}
        description={t(
          'Confirm you have sent the red envelope offline. Record the payment reference here.'
        )}
        contentClassName='sm:max-w-sm'
        contentHeight='auto'
        bodyClassName='space-y-3'
      >
        <div className='text-muted-foreground text-sm'>
          {payTarget?.username} · {formatQuota(payTarget?.amount ?? 0)}
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs'>{t('Payment reference')}</Label>
          <Input
            value={payRemark}
            onChange={(e) => setPayRemark(e.target.value)}
          />
        </div>
        <div className='flex justify-end gap-2'>
          <Button variant='outline' onClick={() => setPayTarget(null)}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={() =>
              payTarget && submitReview(payTarget, 'pay', payRemark.trim())
            }
            disabled={actionLoading}
          >
            {t('Mark as paid')}
          </Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null)
        }}
        title={t('Reject Withdrawal')}
        desc={t(
          'Reject this withdrawal? The frozen commission will be returned to the agent.'
        )}
        destructive
        isLoading={actionLoading}
        handleConfirm={() =>
          rejectTarget && submitReview(rejectTarget, 'reject')
        }
      />
    </div>
  )
}
