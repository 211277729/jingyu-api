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
import { Ban, Check, Link2, RotateCcw, Trash2, Wallet } from 'lucide-react'
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
import {
  type AgentProfileView,
  adjustAgentQuota,
  bindAgentCustomer,
  deleteAgentProfile,
  getAgentProfiles,
  reviewAgentProfile,
} from '@/features/agent-admin/api'
import {
  EmptyRow,
  Pager,
  TableShell,
} from '@/features/agent-admin/components/table-kit'
import { formatDateTime } from '@/features/agent-admin/format'
import { parseQuotaFromDollars } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'

const PAGE_SIZE = 10

const STATUS_BADGE: Record<string, { labelKey: string; className: string }> = {
  pending: {
    labelKey: 'Pending',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  approved: {
    labelKey: 'Approved',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  rejected: {
    labelKey: 'Rejected',
    className: 'bg-red-500/10 text-red-600 dark:text-red-400',
  },
  disabled: {
    labelKey: 'Disabled',
    className: 'bg-muted text-muted-foreground',
  },
}

interface ProfilesTableProps {
  /** applications = 仅待审核申请；manage = 全部代理档案管理 */
  mode: 'applications' | 'manage'
}

/**
 * 代理档案列表：mode=applications 时只看待审核申请（通过/拒绝）；
 * mode=manage 时展示全部档案（调费率、禁用、调额、绑定客户）。
 */
export function ProfilesTable({ mode }: ProfilesTableProps) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState(
    mode === 'applications' ? 'pending' : ''
  )
  const [keyword, setKeyword] = useState('')

  const [reviewTarget, setReviewTarget] = useState<AgentProfileView | null>(
    null
  )
  const [rejectTarget, setRejectTarget] = useState<AgentProfileView | null>(
    null
  )
  const [disableTarget, setDisableTarget] = useState<AgentProfileView | null>(
    null
  )
  const [deleteTarget, setDeleteTarget] = useState<AgentProfileView | null>(
    null
  )
  const [enableTarget, setEnableTarget] = useState<AgentProfileView | null>(
    null
  )
  const [quotaTarget, setQuotaTarget] = useState<AgentProfileView | null>(null)
  const [bindTarget, setBindTarget] = useState<AgentProfileView | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // 审核表单
  const [tier, setTier] = useState('1')
  const [firstPercent, setFirstPercent] = useState('')
  const [percent, setPercent] = useState('')
  const [reviewRemark, setReviewRemark] = useState('')
  // 调额 / 绑定客户表单
  const [quotaDelta, setQuotaDelta] = useState('')
  const [quotaRemark, setQuotaRemark] = useState('')
  const [customerUserId, setCustomerUserId] = useState('')

  const query = useQuery({
    queryKey: ['agent-admin-profiles', page, statusFilter, keyword, mode],
    queryFn: () =>
      getAgentProfiles({
        p: page,
        page_size: PAGE_SIZE,
        status: statusFilter || undefined,
        keyword: keyword || undefined,
      }),
  })

  const refresh = () => void query.refetch()

  const submitProfileReview = async (
    profile: AgentProfileView,
    status: 'approved' | 'rejected' | 'disabled'
  ) => {
    setActionLoading(true)
    try {
      await reviewAgentProfile({
        id: profile.id,
        status,
        tier: Number(tier) || 1,
        first_percent: Number(firstPercent) || 0,
        percent: Number(percent) || 0,
        remark: reviewRemark.trim(),
      })
      toast.success(t('Saved'))
      setReviewTarget(null)
      setRejectTarget(null)
      setDisableTarget(null)
      setEnableTarget(null)
      setReviewRemark('')
      setFirstPercent('')
      setPercent('')
      refresh()
    } catch (error) {
      handleServerError(error, t('Failed to save'))
    } finally {
      setActionLoading(false)
    }
  }

  const submitDelete = async (profile: AgentProfileView) => {
    setActionLoading(true)
    try {
      await deleteAgentProfile(profile.id)
      toast.success(t('Deleted'))
      setDeleteTarget(null)
      refresh()
    } catch (error) {
      handleServerError(error, t('Failed to delete'))
    } finally {
      setActionLoading(false)
    }
  }

  const submitAdjustQuota = async () => {
    if (!quotaTarget) return
    const usd = Number(quotaDelta)
    if (!Number.isFinite(usd) || usd === 0) {
      toast.error(t('Invalid amount'))
      return
    }
    setActionLoading(true)
    try {
      await adjustAgentQuota({
        user_id: quotaTarget.user_id,
        quota: parseQuotaFromDollars(usd),
        remark: quotaRemark.trim(),
      })
      toast.success(t('Saved'))
      setQuotaTarget(null)
      setQuotaDelta('')
      setQuotaRemark('')
      refresh()
    } catch (error) {
      handleServerError(error, t('Failed to save'))
    } finally {
      setActionLoading(false)
    }
  }

  const submitBindCustomer = async () => {
    if (!bindTarget) return
    const userId = Number(customerUserId)
    if (!Number.isInteger(userId) || userId <= 0) {
      toast.error(t('Invalid user ID'))
      return
    }
    setActionLoading(true)
    try {
      await bindAgentCustomer({
        user_id: userId,
        agent_user_id: bindTarget.user_id,
      })
      toast.success(t('Customer bound to agent'))
      setBindTarget(null)
      setCustomerUserId('')
      refresh()
    } catch (error) {
      handleServerError(error, t('Failed to save'))
    } finally {
      setActionLoading(false)
    }
  }

  const items = query.data?.items ?? []
  const statusBadge = (status: string) => {
    const item = STATUS_BADGE[status] ?? STATUS_BADGE.pending
    return (
      <Badge variant='outline' className={item.className}>
        {t(item.labelKey)}
      </Badge>
    )
  }

  const renderActions = (item: AgentProfileView) => {
    if (mode === 'applications') {
      return (
        <>
          <Button
            size='sm'
            variant='outline'
            className='h-7 text-xs'
            onClick={() => {
              setReviewTarget(item)
              setTier(String(item.tier || 1))
              setFirstPercent(
                item.first_percent ? String(item.first_percent) : ''
              )
              setPercent(item.percent ? String(item.percent) : '')
              setReviewRemark('')
            }}
          >
            <Check className='size-3.5' />
            {t('Approve')}
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
      )
    }
    if (item.status === 'disabled') {
      return (
        <Button
          size='sm'
          variant='outline'
          className='h-7 text-xs'
          onClick={() => {
            // 启用走 approved 通道会回写费率，先把档案当前值填入表单，避免被默认值覆盖
            setTier(String(item.tier || 1))
            setFirstPercent(
              item.first_percent ? String(item.first_percent) : ''
            )
            setPercent(item.percent ? String(item.percent) : '')
            setEnableTarget(item)
          }}
        >
          <RotateCcw className='size-3.5' />
          {t('Enable')}
        </Button>
      )
    }
    if (item.status !== 'approved') {
      return null
    }
    return (
      <>
        <Button
          size='sm'
          variant='outline'
          className='h-7 text-xs'
          onClick={() => {
            setReviewTarget(item)
            setTier(String(item.tier || 1))
            setFirstPercent(
              item.first_percent ? String(item.first_percent) : ''
            )
            setPercent(item.percent ? String(item.percent) : '')
            setReviewRemark('')
          }}
        >
          {t('Edit rates')}
        </Button>
        <Button
          size='sm'
          variant='outline'
          className='h-7 text-xs'
          onClick={() => setQuotaTarget(item)}
        >
          <Wallet className='size-3.5' />
          {t('Adjust quota')}
        </Button>
        <Button
          size='sm'
          variant='outline'
          className='h-7 text-xs'
          onClick={() => setBindTarget(item)}
        >
          <Link2 className='size-3.5' />
          {t('Bind customer')}
        </Button>
        <Button
          size='sm'
          variant='outline'
          className='text-destructive h-7 text-xs'
          onClick={() => setDisableTarget(item)}
        >
          <Ban className='size-3.5' />
          {t('Disable')}
        </Button>
        <Button
          size='sm'
          variant='outline'
          className='text-destructive h-7 text-xs'
          onClick={() => setDeleteTarget(item)}
        >
          <Trash2 className='size-3.5' />
          {t('Delete')}
        </Button>
      </>
    )
  }

  return (
    <div className='space-y-3'>
      {mode === 'manage' ? (
        <div className='flex flex-wrap items-center gap-2'>
          <NativeSelect
            className='w-36'
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value=''>{t('All statuses')}</option>
            <option value='pending'>{t('Pending')}</option>
            <option value='approved'>{t('Approved')}</option>
            <option value='rejected'>{t('Rejected')}</option>
            <option value='disabled'>{t('Disabled')}</option>
          </NativeSelect>
          <Input
            className='w-52'
            placeholder={t('Search username')}
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              setPage(1)
            }}
          />
        </div>
      ) : null}

      <TableShell
        header={
          <>
            <th className='px-3 py-2 font-medium'>ID</th>
            <th className='px-3 py-2 font-medium'>{t('User')}</th>
            <th className='px-3 py-2 font-medium'>{t('Status')}</th>
            <th className='px-3 py-2 font-medium'>{t('Contact')}</th>
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
              {item.display_name || item.username}
              <span className='text-muted-foreground ml-1.5 text-xs'>
                (#{item.user_id})
              </span>
            </td>
            <td className='px-3 py-2'>{statusBadge(item.status)}</td>
            <td className='text-muted-foreground max-w-36 truncate px-3 py-2 text-xs'>
              {item.contact || '-'}
            </td>
            <td className='px-3 py-2 text-xs tabular-nums'>
              {formatDateTime(item.applied_at)}
            </td>
            <td className='text-muted-foreground max-w-44 truncate px-3 py-2 text-xs'>
              {item.remark || '-'}
            </td>
            <td className='px-3 py-2'>
              <div className='flex items-center gap-1'>
                {renderActions(item)}
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

      {/* 通过 / 调费率弹窗 */}
      <Dialog
        open={reviewTarget !== null}
        onOpenChange={(open) => {
          if (!open) setReviewTarget(null)
        }}
        title={t('Approve Agent')}
        description={t(
          'Set the tier and commission rate overrides; leave rates as 0 to use global settings.'
        )}
        contentClassName='sm:max-w-sm'
        contentHeight='auto'
        bodyClassName='space-y-3'
      >
        <div className='space-y-1.5'>
          <Label className='text-xs'>{t('Tier')}</Label>
          <NativeSelect value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value='1'>{t('Standard Agent')}</option>
            <option value='2'>{t('Senior Agent')}</option>
          </NativeSelect>
        </div>
        <div className='grid grid-cols-2 gap-2'>
          <div className='space-y-1.5'>
            <Label className='text-xs'>{t('First top-up rate (%)')}</Label>
            <Input
              type='number'
              min={0}
              max={100}
              step='0.1'
              value={firstPercent}
              onChange={(e) => setFirstPercent(e.target.value)}
              placeholder='0'
            />
          </div>
          <div className='space-y-1.5'>
            <Label className='text-xs'>{t('Recurring rate (%)')}</Label>
            <Input
              type='number'
              min={0}
              max={100}
              step='0.1'
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              placeholder='0'
            />
          </div>
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs'>{t('Remark')}</Label>
          <Input
            value={reviewRemark}
            onChange={(e) => setReviewRemark(e.target.value)}
          />
        </div>
        <div className='flex justify-end gap-2'>
          <Button variant='outline' onClick={() => setReviewTarget(null)}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={() =>
              reviewTarget && submitProfileReview(reviewTarget, 'approved')
            }
            disabled={actionLoading}
          >
            {t('Confirm Approval')}
          </Button>
        </div>
      </Dialog>

      {/* 拒绝确认 */}
      <ConfirmDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRejectTarget(null)
        }}
        title={t('Reject Application')}
        desc={t(
          'Reject this agent application? The user can apply again later.'
        )}
        destructive
        isLoading={actionLoading}
        handleConfirm={() =>
          rejectTarget && submitProfileReview(rejectTarget, 'rejected')
        }
      />

      {/* 禁用确认 */}
      <ConfirmDialog
        open={disableTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDisableTarget(null)
        }}
        title={t('Disable Agent')}
        desc={t(
          'Disable this agent? Their customers will stop generating commission.'
        )}
        destructive
        isLoading={actionLoading}
        handleConfirm={() =>
          disableTarget && submitProfileReview(disableTarget, 'disabled')
        }
      />

      {/* 启用确认：禁用代理恢复为已通过，佣金恢复正常产生 */}
      <ConfirmDialog
        open={enableTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEnableTarget(null)
        }}
        title={t('Enable Agent')}
        desc={t(
          'Enable this agent? Their customers will resume generating commission.'
        )}
        isLoading={actionLoading}
        handleConfirm={() =>
          enableTarget && submitProfileReview(enableTarget, 'approved')
        }
      />

      {/* 删除确认：删除后可重新申请，区别于禁用 */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t('Delete Agent')}
        desc={t(
          'Delete this agent profile? Their commission balance is kept and they can apply again later.'
        )}
        destructive
        isLoading={actionLoading}
        handleConfirm={() => deleteTarget && submitDelete(deleteTarget)}
      />

      {/* 调额弹窗 */}
      <Dialog
        open={quotaTarget !== null}
        onOpenChange={(open) => {
          if (!open) setQuotaTarget(null)
        }}
        title={t('Adjust Commission Quota')}
        description={t(
          'Positive adds commission, negative deducts. Use this to settle payouts manually.'
        )}
        contentClassName='sm:max-w-sm'
        contentHeight='auto'
        bodyClassName='space-y-3'
      >
        <div className='text-muted-foreground text-sm'>
          {t('User')}: {quotaTarget?.username} (#{quotaTarget?.user_id})
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs'>{t('Amount in USD (±)')}</Label>
          <Input
            type='number'
            step='0.01'
            value={quotaDelta}
            onChange={(e) => setQuotaDelta(e.target.value)}
            placeholder='-5.00'
          />
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs'>{t('Remark')}</Label>
          <Input
            value={quotaRemark}
            onChange={(e) => setQuotaRemark(e.target.value)}
          />
        </div>
        <div className='flex justify-end gap-2'>
          <Button variant='outline' onClick={() => setQuotaTarget(null)}>
            {t('Cancel')}
          </Button>
          <Button onClick={submitAdjustQuota} disabled={actionLoading}>
            {t('Save')}
          </Button>
        </div>
      </Dialog>

      {/* 绑定客户弹窗 */}
      <Dialog
        open={bindTarget !== null}
        onOpenChange={(open) => {
          if (!open) setBindTarget(null)
        }}
        title={t('Bind Customer')}
        description={t(
          'Move a registered customer to this agent by user ID. The current inviter will be replaced.'
        )}
        contentClassName='sm:max-w-sm'
        contentHeight='auto'
        bodyClassName='space-y-3'
      >
        <div className='space-y-1.5'>
          <Label className='text-xs'>{t('Customer User ID')}</Label>
          <Input
            type='number'
            min={1}
            value={customerUserId}
            onChange={(e) => setCustomerUserId(e.target.value)}
          />
        </div>
        <div className='flex justify-end gap-2'>
          <Button variant='outline' onClick={() => setBindTarget(null)}>
            {t('Cancel')}
          </Button>
          <Button onClick={submitBindCustomer} disabled={actionLoading}>
            {t('Confirm Binding')}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
