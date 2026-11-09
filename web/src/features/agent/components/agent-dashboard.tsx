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
import {
  BanknoteArrowDown,
  ChevronLeft,
  ChevronRight,
  Users,
  Wallet,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getAgentCommissions,
  getAgentCustomers,
  getAgentWithdrawals,
  requestAgentWithdraw,
} from '@/features/agent/api'
import type {
  AgentProfileData,
  AgentWithdrawalStatus,
} from '@/features/agent/types'
import { InviteLinkCard } from '@/features/invite/components/invite-link-card'
import { useAffiliate } from '@/features/wallet/hooks'
import {
  formatQuota,
  parseQuotaFromDollars,
  quotaUnitsToDollars,
} from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 10

function formatDateTime(timestamp: number): string {
  if (!timestamp) return '-'
  return new Date(timestamp * 1000).toLocaleString()
}

/** 数据表外框：卡片容器 + 表头分隔，主题自适应。 */
function TableShell({
  header,
  children,
}: {
  header: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className='border-border/60 bg-card overflow-hidden rounded-2xl border shadow-sm'>
      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='bg-muted/40 border-b text-left text-xs whitespace-nowrap'>
              {header}
            </tr>
          </thead>
          <tbody className='divide-y'>{children}</tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className='text-muted-foreground px-4 py-2.5 text-[11px] font-medium tracking-wider uppercase'>
      {children}
    </th>
  )
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  const { t } = useTranslation()
  return (
    <tr>
      <td
        colSpan={colSpan}
        className='text-muted-foreground py-10 text-center text-xs'
      >
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
  const map: Record<
    AgentWithdrawalStatus,
    { label: string; className: string }
  > = {
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
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        item.className
      )}
    >
      {item.label}
    </span>
  )
}

/** 列表切换标签 + 佣金/客户/提现三个数据视图。 */
const VIEWS = [
  { value: 'commissions', labelKey: 'Commission Details' },
  { value: 'customers', labelKey: 'My Customers' },
  { value: 'withdrawals', labelKey: 'Withdrawal Records' },
] as const

type ViewValue = (typeof VIEWS)[number]['value']

interface AgentDashboardProps {
  data: AgentProfileData
  onRefresh: () => void
}

/**
 * 代理中心：佣金余额与统计、提现申请，以及佣金明细 / 名下客户 / 提现记录三个列表。
 * 视觉为控制台风但主题自适应（浅/深两套都成立），佣金主题保持金色。
 */
export function AgentDashboard({ data, onRefresh }: AgentDashboardProps) {
  const { t } = useTranslation()
  const [view, setView] = useState<ViewValue>('commissions')
  const [commissionsPage, setCommissionsPage] = useState(1)
  const [customersPage, setCustomersPage] = useState(1)
  const [withdrawalsPage, setWithdrawalsPage] = useState(1)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawUsd, setWithdrawUsd] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const profile = data.profile
  const firstPercent =
    profile && profile.first_percent > 0
      ? profile.first_percent
      : data.first_percent
  const percent =
    profile && profile.percent > 0 ? profile.percent : data.percent

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
      toast.error(
        t('Withdrawal amount is below the minimum of ${{amount}}', {
          amount: minWithdrawUsd.toFixed(2),
        })
      )
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

  const stats = [
    {
      icon: Wallet,
      label: t('Commission Balance'),
      node: (
        <div className='bg-gradient-to-br from-amber-600 to-orange-500 bg-clip-text text-2xl font-bold text-transparent tabular-nums sm:text-3xl dark:from-amber-400 dark:to-orange-400'>
          {formatQuota(data.agent_quota)}
        </div>
      ),
    },
    {
      icon: BanknoteArrowDown,
      label: t('Total Commission Earned'),
      node: (
        <div className='bg-gradient-to-br from-amber-600 to-orange-500 bg-clip-text text-2xl font-bold text-transparent tabular-nums sm:text-3xl dark:from-amber-400 dark:to-orange-400'>
          {formatQuota(data.agent_history_quota)}
        </div>
      ),
    },
    {
      icon: Users,
      label: t('Commission Rates'),
      node: (
        <div className='text-lg font-semibold tabular-nums sm:text-xl'>
          {t('First {{first}}% · Then {{later}}%', {
            first: firstPercent,
            later: percent,
          })}
        </div>
      ),
    },
  ] as const

  return (
    <div className='space-y-6'>
      {/* 推广物料：邀请码/链接/二维码，与邀请返利页同一个码 */}
      <InviteLinkCard
        affiliateCode={affiliateCode}
        affiliateLink={affiliateLink}
        loading={affiliateLoading}
      />

      {/* 统计大读数面板 */}
      <section className='border-border/60 relative overflow-hidden rounded-3xl border bg-gradient-to-b from-amber-500/[0.08] to-transparent p-5 shadow-sm sm:p-7 dark:from-amber-500/[0.10]'>
        <div
          aria-hidden
          className='pointer-events-none absolute -top-20 right-0 size-72 rounded-full bg-amber-500/10 blur-3xl'
        />
        <div className='relative grid grid-cols-1 gap-3 sm:grid-cols-3'>
          {stats.map((item) => (
            <div
              key={item.label}
              className='border-border/60 bg-background/80 rounded-2xl border px-4 py-5 shadow-sm backdrop-blur'
            >
              <div className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium tracking-wide'>
                <item.icon className='size-3.5 text-amber-600 dark:text-amber-400' />
                {item.label}
              </div>
              <div className='mt-2'>{item.node}</div>
            </div>
          ))}
        </div>
      </section>

      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-muted-foreground text-xs leading-relaxed'>
          {t(
            'Withdrawals are settled manually: once approved, the commission is paid to you via red envelope.'
          )}
        </p>
        <Button
          onClick={() => setWithdrawOpen(true)}
          className='bg-gradient-to-r from-amber-500 to-orange-500 font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:from-amber-600 hover:to-orange-600 dark:from-amber-400 dark:to-orange-400 dark:text-zinc-950 dark:shadow-amber-400/20 dark:hover:from-amber-300 dark:hover:to-orange-300'
        >
          <BanknoteArrowDown className='size-4' />
          {t('Request Withdrawal')}
        </Button>
      </div>

      {/* 三个列表：分段切换 + 数据表 */}
      <section className='border-border/60 bg-card space-y-4 rounded-3xl border p-5 shadow-sm sm:p-7'>
        <div
          role='tablist'
          className='bg-muted/40 border-border/60 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border p-1'
        >
          {VIEWS.map((item) => (
            <button
              key={item.value}
              type='button'
              role='tab'
              aria-selected={view === item.value}
              onClick={() => setView(item.value)}
              className={cn(
                'rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all sm:text-sm',
                view === item.value
                  ? 'bg-amber-500/15 font-semibold text-amber-700 ring-1 ring-amber-500/30 dark:bg-amber-400/15 dark:text-amber-300 dark:ring-amber-400/30'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>

        <div role='tabpanel' className='space-y-3'>
          {view === 'commissions' ? (
            <>
              <TableShell
                header={
                  <>
                    <Th>{t('Time')}</Th>
                    <Th>{t('Customer')}</Th>
                    <Th>{t('Level')}</Th>
                    <Th>{t('Top-up Amount')}</Th>
                    <Th>{t('Rate')}</Th>
                    <Th>{t('Commission')}</Th>
                  </>
                }
              >
                {(commissions.data?.items ?? []).map((item) => (
                  <tr
                    key={item.id}
                    className='hover:bg-muted/30 whitespace-nowrap transition-colors'
                  >
                    <td className='text-muted-foreground px-4 py-3 text-xs tabular-nums'>
                      {formatDateTime(item.created_at)}
                    </td>
                    <td className='px-4 py-3 font-medium'>
                      {item.payer_username}
                    </td>
                    <td className='px-4 py-3'>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          item.level === 2
                            ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
                            : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                        )}
                      >
                        {item.level === 2 ? t('Level 2') : t('Level 1')}
                      </span>
                    </td>
                    <td className='px-4 py-3 tabular-nums'>
                      {formatQuota(item.credited_quota)}
                    </td>
                    <td className='text-muted-foreground px-4 py-3 tabular-nums'>
                      {item.percent}%
                    </td>
                    <td className='px-4 py-3 font-semibold text-emerald-600 tabular-nums dark:text-emerald-400'>
                      +{formatQuota(item.commission_quota)}
                    </td>
                  </tr>
                ))}
                {commissions.data?.items?.length === 0 ? (
                  <EmptyRow colSpan={6} />
                ) : null}
              </TableShell>
              <Pager
                page={commissionsPage}
                total={commissions.data?.total ?? 0}
                onPageChange={setCommissionsPage}
              />
            </>
          ) : null}

          {view === 'customers' ? (
            <>
              <TableShell
                header={
                  <>
                    <Th>{t('Customer')}</Th>
                    <Th>{t('Registered At')}</Th>
                    <Th>{t('Commission Generated')}</Th>
                  </>
                }
              >
                {(customers.data?.items ?? []).map((item) => (
                  <tr
                    key={item.user_id}
                    className='hover:bg-muted/30 whitespace-nowrap transition-colors'
                  >
                    <td className='px-4 py-3 font-medium'>
                      {item.display_name || item.username}
                    </td>
                    <td className='text-muted-foreground px-4 py-3 text-xs tabular-nums'>
                      {formatDateTime(item.created_at)}
                    </td>
                    <td className='px-4 py-3 font-semibold tabular-nums'>
                      {formatQuota(Number(item.total_commission) || 0)}
                    </td>
                  </tr>
                ))}
                {customers.data?.items?.length === 0 ? (
                  <EmptyRow colSpan={3} />
                ) : null}
              </TableShell>
              <Pager
                page={customersPage}
                total={customers.data?.total ?? 0}
                onPageChange={setCustomersPage}
              />
            </>
          ) : null}

          {view === 'withdrawals' ? (
            <>
              <TableShell
                header={
                  <>
                    <Th>{t('Time')}</Th>
                    <Th>{t('Amount')}</Th>
                    <Th>{t('Status')}</Th>
                    <Th>{t('Remark')}</Th>
                  </>
                }
              >
                {(withdrawals.data?.items ?? []).map((item) => (
                  <tr
                    key={item.id}
                    className='hover:bg-muted/30 whitespace-nowrap transition-colors'
                  >
                    <td className='text-muted-foreground px-4 py-3 text-xs tabular-nums'>
                      {formatDateTime(item.applied_at)}
                    </td>
                    <td className='px-4 py-3 font-semibold tabular-nums'>
                      {formatQuota(item.amount)}
                    </td>
                    <td className='px-4 py-3'>
                      <WithdrawalStatusBadge status={item.status} />
                    </td>
                    <td className='text-muted-foreground max-w-60 truncate px-4 py-3 text-xs'>
                      {item.remark || '-'}
                    </td>
                  </tr>
                ))}
                {withdrawals.data?.items?.length === 0 ? (
                  <EmptyRow colSpan={4} />
                ) : null}
              </TableShell>
              <Pager
                page={withdrawalsPage}
                total={withdrawals.data?.total ?? 0}
                onPageChange={setWithdrawalsPage}
              />
            </>
          ) : null}
        </div>
      </section>

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
                ? t('Minimum ${{amount}}', {
                    amount: minWithdrawUsd.toFixed(2),
                  })
                : t('Amount in USD')
            }
          />
        </div>
        <div className='flex justify-end gap-2'>
          <Button variant='outline' onClick={() => setWithdrawOpen(false)}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleWithdraw}
            disabled={submitting}
            className='bg-gradient-to-r from-amber-500 to-orange-500 font-semibold text-white shadow-lg shadow-amber-500/25 transition-all hover:from-amber-600 hover:to-orange-600 disabled:cursor-not-allowed disabled:opacity-60 dark:from-amber-400 dark:to-orange-400 dark:text-zinc-950 dark:shadow-amber-400/20 dark:hover:from-amber-300 dark:hover:to-orange-300'
          >
            {submitting ? t('Submitting') : t('Submit Application')}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
