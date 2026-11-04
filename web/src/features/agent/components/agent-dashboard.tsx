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
import { BanknoteArrowDown, ChevronLeft, ChevronRight, Users, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { InviteLinkCard } from '@/features/invite/components/invite-link-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getAgentCommissions, getAgentCustomers, getAgentWithdrawals, requestAgentWithdraw } from '@/features/agent/api'
import type { AgentProfileData, AgentWithdrawalStatus } from '@/features/agent/types'
import { useAffiliate } from '@/features/wallet/hooks'
import { formatQuota, parseQuotaFromDollars, quotaUnitsToDollars } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'

const PAGE_SIZE = 10

function formatDateTime(timestamp: number): string {
  if (!timestamp) return '-'
  return new Date(timestamp * 1000).toLocaleString()
}

function TableShell({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className='overflow-x-auto rounded-lg border'>
      <table className='w-full text-sm'>
        <thead>
          <tr className='bg-muted/50 border-b text-left text-xs whitespace-nowrap'>
            {header}
          </tr>
        </thead>
        <tbody className='divide-y'>{children}</tbody>
      </table>
    </div>
  )
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  const { t } = useTranslation()
  return (
    <tr>
      <td colSpan={colSpan} className='text-muted-foreground py-8 text-center text-xs'>
        {t('No data')}
      </td>
    </tr>
  )
}

function Pager({
  page,
  total,
  onPageChange,
}: {
  page: number
  total: number
  onPageChange: (page: number) => void
}) {
  const { t } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  if (total <= PAGE_SIZE) return null
  return (
    <div className='flex items-center justify-end gap-2'>
      <span className='text-muted-foreground text-xs tabular-nums'>
        {page} / {totalPages} · {t('{{count}} total', { count: total })}
      </span>
      <Button
        variant='outline'
        size='icon'
        className='size-7'
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className='size-3.5' />
      </Button>
      <Button
        variant='outline'
        size='icon'
        className='size-7'
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className='size-3.5' />
      </Button>
    </div>
  )
}

function WithdrawalStatusBadge({ status }: { status: AgentWithdrawalStatus }) {
  const { t } = useTranslation()
  const map: Record<AgentWithdrawalStatus, { label: string; className: string }> = {
    pending: {
      label: t('Under review'),
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    approved: {
      label: t('Awaiting payout'),
      className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    },
    paid: {
      label: t('Paid'),
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    rejected: {
      label: t('Rejected'),
      className: 'bg-red-500/10 text-red-600 dark:text-red-400',
    },
  }
  const item = map[status]
  return (
    <Badge variant='outline' className={item.className}>
      {item.label}
    </Badge>
  )
}

interface AgentDashboardProps {
  data: AgentProfileData
  onRefresh: () => void
}

/**
 * 代理中心：佣金余额与统计、提现申请，以及佣金明细 / 名下客户 / 提现记录三个列表。
 */
export function AgentDashboard({ data, onRefresh }: AgentDashboardProps) {
  const { t } = useTranslation()
  const [commissionsPage, setCommissionsPage] = useState(1)
  const [customersPage, setCustomersPage] = useState(1)
  const [withdrawalsPage, setWithdrawalsPage] = useState(1)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawUsd, setWithdrawUsd] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const profile = data.profile
  const firstPercent = profile && profile.first_percent > 0 ? profile.first_percent : data.first_percent
  const percent = profile && profile.percent > 0 ? profile.percent : data.percent

  // 推广物料：与邀请返利页同一个邀请码/链接（generateAffiliateLink 生成），代理直接复制销售
  const {
    affiliateCode,
    affiliateLink,
    loading: affiliateLoading,
  } = useAffiliate()

  const commissions = useQuery({
    queryKey: ['agent-commissions', commissionsPage],
    queryFn: () => getAgentCommissions(commissionsPage, PAGE_SIZE),
  })
  const customers = useQuery({
    queryKey: ['agent-customers', customersPage],
    queryFn: () => getAgentCustomers(customersPage, PAGE_SIZE),
  })
  const withdrawals = useQuery({
    queryKey: ['agent-withdrawals', withdrawalsPage],
    queryFn: () => getAgentWithdrawals(withdrawalsPage, PAGE_SIZE),
  })

  const minWithdrawUsd = quotaUnitsToDollars(data.min_withdraw_quota)
  const withdrawAmountUsd = Number(withdrawUsd) || 0

  const handleWithdraw = async () => {
    if (withdrawAmountUsd <= 0) {
      toast.error(t('Invalid withdrawal amount'))
      return
    }
    if (data.min_withdraw_quota > 0 && withdrawAmountUsd < minWithdrawUsd) {
      toast.error(t('Withdrawal amount is below the minimum of ${{amount}}', { amount: minWithdrawUsd.toFixed(2) }))
      return
    }
    setSubmitting(true)
    try {
      await requestAgentWithdraw(parseQuotaFromDollars(withdrawAmountUsd))
      toast.success(t('Withdrawal request submitted'))
      setWithdrawOpen(false)
      setWithdrawUsd('')
      onRefresh()
    } catch (error) {
      handleServerError(error, t('Failed to submit withdrawal request'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className='space-y-4'>
      {/* 推广物料：邀请码/链接/二维码，与邀请返利页同一个码 */}
      <InviteLinkCard
        affiliateCode={affiliateCode}
        affiliateLink={affiliateLink}
        loading={affiliateLoading}
      />

      {/* 统计 + 提现 */}
      <div className='grid gap-3 sm:grid-cols-3'>
        <div className='rounded-2xl border p-4'>
          <div className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium'>
            <Wallet className='size-3.5' />
            {t('Commission Balance')}
          </div>
          <div className='mt-1.5 text-2xl font-semibold tabular-nums'>
            {formatQuota(data.agent_quota)}
          </div>
        </div>
        <div className='rounded-2xl border p-4'>
          <div className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium'>
            <BanknoteArrowDown className='size-3.5' />
            {t('Total Commission Earned')}
          </div>
          <div className='mt-1.5 text-2xl font-semibold tabular-nums'>
            {formatQuota(data.agent_history_quota)}
          </div>
        </div>
        <div className='rounded-2xl border p-4'>
          <div className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium'>
            <Users className='size-3.5' />
            {t('Commission Rates')}
          </div>
          <div className='mt-1.5 text-sm font-semibold tabular-nums'>
            {t('First {{first}}% · Then {{later}}%', { first: firstPercent, later: percent })}
          </div>
        </div>
      </div>

      <div className='flex items-center justify-between gap-2'>
        <p className='text-muted-foreground text-xs'>
          {t(
            'Withdrawals are settled manually: once approved, the commission is paid to you via red envelope.'
          )}
        </p>
        <Button onClick={() => setWithdrawOpen(true)} className='shrink-0'>
          <BanknoteArrowDown className='size-4' />
          {t('Request Withdrawal')}
        </Button>
      </div>

      {/* 三个列表 */}
      <Tabs defaultValue='commissions'>
        <TabsList>
          <TabsTrigger value='commissions'>{t('Commission Details')}</TabsTrigger>
          <TabsTrigger value='customers'>{t('My Customers')}</TabsTrigger>
          <TabsTrigger value='withdrawals'>{t('Withdrawal Records')}</TabsTrigger>
        </TabsList>

        <TabsContent value='commissions' className='space-y-2'>
          <TableShell
            header={
              <>
                <th className='px-3 py-2 font-medium'>{t('Time')}</th>
                <th className='px-3 py-2 font-medium'>{t('Customer')}</th>
                <th className='px-3 py-2 font-medium'>{t('Level')}</th>
                <th className='px-3 py-2 font-medium'>{t('Top-up Amount')}</th>
                <th className='px-3 py-2 font-medium'>{t('Rate')}</th>
                <th className='px-3 py-2 font-medium'>{t('Commission')}</th>
              </>
            }
          >
            {(commissions.data?.items ?? []).map((item) => (
              <tr key={item.id} className='whitespace-nowrap'>
                <td className='px-3 py-2 text-xs tabular-nums'>{formatDateTime(item.created_at)}</td>
                <td className='px-3 py-2 font-medium'>{item.payer_username}</td>
                <td className='px-3 py-2'>
                  <Badge variant='outline'>{item.level === 2 ? t('Level 2') : t('Level 1')}</Badge>
                </td>
                <td className='px-3 py-2 tabular-nums'>{formatQuota(item.credited_quota)}</td>
                <td className='px-3 py-2 tabular-nums'>{item.percent}%</td>
                <td className='px-3 py-2 font-semibold tabular-nums text-emerald-600 dark:text-emerald-400'>
                  +{formatQuota(item.commission_quota)}
                </td>
              </tr>
            ))}
            {commissions.data?.items?.length === 0 ? <EmptyRow colSpan={6} /> : null}
          </TableShell>
          <Pager
            page={commissionsPage}
            total={commissions.data?.total ?? 0}
            onPageChange={setCommissionsPage}
          />
        </TabsContent>

        <TabsContent value='customers' className='space-y-2'>
          <TableShell
            header={
              <>
                <th className='px-3 py-2 font-medium'>{t('Customer')}</th>
                <th className='px-3 py-2 font-medium'>{t('Registered At')}</th>
                <th className='px-3 py-2 font-medium'>{t('Commission Generated')}</th>
              </>
            }
          >
            {(customers.data?.items ?? []).map((item) => (
              <tr key={item.user_id} className='whitespace-nowrap'>
                <td className='px-3 py-2 font-medium'>
                  {item.display_name || item.username}
                </td>
                <td className='px-3 py-2 text-xs tabular-nums'>{formatDateTime(item.created_at)}</td>
                <td className='px-3 py-2 font-semibold tabular-nums'>
                  {formatQuota(Number(item.total_commission) || 0)}
                </td>
              </tr>
            ))}
            {customers.data?.items?.length === 0 ? <EmptyRow colSpan={3} /> : null}
          </TableShell>
          <Pager
            page={customersPage}
            total={customers.data?.total ?? 0}
            onPageChange={setCustomersPage}
          />
        </TabsContent>

        <TabsContent value='withdrawals' className='space-y-2'>
          <TableShell
            header={
              <>
                <th className='px-3 py-2 font-medium'>{t('Time')}</th>
                <th className='px-3 py-2 font-medium'>{t('Amount')}</th>
                <th className='px-3 py-2 font-medium'>{t('Status')}</th>
                <th className='px-3 py-2 font-medium'>{t('Remark')}</th>
              </>
            }
          >
            {(withdrawals.data?.items ?? []).map((item) => (
              <tr key={item.id} className='whitespace-nowrap'>
                <td className='px-3 py-2 text-xs tabular-nums'>{formatDateTime(item.applied_at)}</td>
                <td className='px-3 py-2 font-semibold tabular-nums'>{formatQuota(item.amount)}</td>
                <td className='px-3 py-2'>
                  <WithdrawalStatusBadge status={item.status} />
                </td>
                <td className='text-muted-foreground max-w-60 truncate px-3 py-2 text-xs'>
                  {item.remark || '-'}
                </td>
              </tr>
            ))}
            {withdrawals.data?.items?.length === 0 ? <EmptyRow colSpan={4} /> : null}
          </TableShell>
          <Pager
            page={withdrawalsPage}
            total={withdrawals.data?.total ?? 0}
            onPageChange={setWithdrawalsPage}
          />
        </TabsContent>
      </Tabs>

      {/* 提现弹窗 */}
      <Dialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        title={t('Request Withdrawal')}
        description={t(
          'Withdrawals are settled manually: once approved, the commission is paid to you via red envelope.'
        )}
        contentClassName='sm:max-w-sm'
        contentHeight='auto'
        bodyClassName='space-y-3'
      >
        <div className='space-y-2'>
          <div className='text-muted-foreground text-sm'>
            {t('Commission Balance')}:{' '}
            <span className='text-foreground font-semibold tabular-nums'>
              {formatQuota(data.agent_quota)}
            </span>
          </div>
          <Input
            type='number'
            min={0}
            step='0.01'
            value={withdrawUsd}
            onChange={(e) => setWithdrawUsd(e.target.value)}
            placeholder={
              data.min_withdraw_quota > 0
                ? t('Minimum ${{amount}}', { amount: minWithdrawUsd.toFixed(2) })
                : t('Amount in USD')
            }
          />
        </div>
        <div className='flex justify-end gap-2'>
          <Button variant='outline' onClick={() => setWithdrawOpen(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleWithdraw} disabled={submitting}>
            {submitting ? t('Submitting') : t('Submit Application')}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
