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
import { useNavigate } from '@tanstack/react-router'
import { CalendarCheck, ChevronRight, Gift, Sparkles, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Turnstile } from '@/components/turnstile'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useCheckin } from '@/features/profile/hooks'
import type { CheckinRecord } from '@/features/profile/types'
import { useStatus } from '@/hooks/use-status'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { formatQuota } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

/**
 * The "Super Rewards" pill shown in the site header.
 *
 * A gradient call-to-action that funnels visitors into the two growth
 * loops: daily check-in and the referral program. For guests it sends
 * people to sign in / sign up; for signed-in users it opens a popover
 * with both entries and hosts the compact check-in dialog.
 */
export function SuperRewardButton({ className }: { className?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => !!s.auth.user)
  const pendingRewards = useAuthStore((s) => s.auth.user?.aff_quota ?? 0)
  const { status } = useStatus()
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const checkinEnabled = isAuthenticated && status?.checkin_enabled === true
  const turnstileEnabled = !!(
    status?.turnstile_check && status?.turnstile_site_key
  )
  const turnstileSiteKey = status?.turnstile_site_key || ''

  const {
    checkinData,
    isLoading: checkinStatusLoading,
    checkedToday,
    doCheckin,
    checkinLoading,
    turnstileModalVisible,
    setTurnstileModalVisible,
    turnstileWidgetKey,
    setTurnstileWidgetKey,
  } = useCheckin({ checkinEnabled, turnstileEnabled, turnstileSiteKey })

  const monthlyQuota = useMemo(() => {
    const records = checkinData?.stats?.records || []
    return records.reduce(
      (sum: number, record: CheckinRecord) => sum + (record.quota_awarded || 0),
      0
    )
  }, [checkinData?.stats?.records])

  const todayAward = useMemo(() => {
    const now = new Date()
    const todayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return (checkinData?.stats?.records || []).find(
      (record: CheckinRecord) => record.checkin_date === todayString
    )?.quota_awarded
  }, [checkinData?.stats?.records])

  const handlePillClick = () => {
    if (!isAuthenticated) {
      navigate({ to: '/sign-in' })
    }
  }

  const pill = (
    <Button
      onClick={handlePillClick}
      className='super-reward-pill relative h-8 gap-1.5 overflow-visible rounded-full px-3 text-xs font-bold text-white shadow-[0_2px_12px_-2px_rgba(168,85,247,0.55)] transition-[filter] hover:brightness-110'
    >
      {/* Decorative sparkle dots, echoing the peer-site pill style */}
      <span className='pointer-events-none absolute top-1 left-2 size-1 rounded-full bg-white/60' />
      <span className='pointer-events-none absolute right-3 bottom-1 size-1.5 rounded-full bg-white/40' />
      <Gift className='size-3.5' />
      <span>{t('Super Rewards')}</span>
      {checkinEnabled && !checkinStatusLoading && !checkedToday ? (
        <span className='bg-background absolute -top-1 -right-1 size-2.5 rounded-full ring-2 ring-red-500' />
      ) : null}
    </Button>
  )

  return (
    <>
      {/* Check-in dialog (signed-in users only) */}
      {checkinEnabled ? (
        <>
          <Dialog
            open={turnstileModalVisible}
            onOpenChange={(open) => {
              setTurnstileModalVisible(open)
              if (!open) {
                setTurnstileWidgetKey((v) => v + 1)
              }
            }}
            title={t('Security Check')}
            contentClassName='sm:max-w-md'
            contentHeight='auto'
            bodyClassName='space-y-4'
          >
            <div className='text-muted-foreground text-sm'>
              {t('Please complete the security check to continue.')}
            </div>
            <div className='flex justify-center py-4'>
              <Turnstile
                key={turnstileWidgetKey}
                siteKey={turnstileSiteKey}
                onVerify={(token) => {
                  doCheckin(token)
                }}
                onExpire={() => {
                  setTurnstileWidgetKey((v) => v + 1)
                }}
              />
            </div>
          </Dialog>

          <Dialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title={t('Daily Check-in')}
            description={t('Check in daily to receive random quota rewards')}
            contentClassName='sm:max-w-md'
            contentHeight='auto'
            bodyClassName='space-y-4'
          >
            <div className='space-y-4 py-1'>
              <Button
                onClick={() => doCheckin()}
                disabled={checkinLoading || checkedToday || checkinStatusLoading}
                size='lg'
                className='h-12 w-full text-base font-semibold'
              >
                {checkedToday ? (
                  <>
                    <Sparkles className='size-4' />
                    {t('Checked in')}
                  </>
                ) : (
                  t('Check in now')
                )}
              </Button>

              {checkedToday && todayAward !== undefined ? (
                <div className='inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400'>
                  <Sparkles className='size-3' />
                  {t('Today')} +{formatQuotaWithCurrency(todayAward)}
                </div>
              ) : null}

              <div className='grid grid-cols-3 gap-px rounded-lg border'>
                <div className='bg-card p-3 text-center'>
                  <div className='text-lg font-semibold tabular-nums'>
                    {checkinData?.stats?.total_checkins || 0}
                  </div>
                  <div className='text-muted-foreground mt-0.5 text-[10px] font-medium'>
                    {t('Total check-ins')}
                  </div>
                </div>
                <div className='bg-card p-3 text-center'>
                  <div className='text-lg font-semibold tabular-nums'>
                    {formatQuotaWithCurrency(monthlyQuota, { digitsLarge: 0 })}
                  </div>
                  <div className='text-muted-foreground mt-0.5 text-[10px] font-medium'>
                    {t('This month')}
                  </div>
                </div>
                <div className='bg-card p-3 text-center'>
                  <div className='text-lg font-semibold tabular-nums'>
                    {formatQuotaWithCurrency(
                      checkinData?.stats?.total_quota || 0,
                      {
                        digitsLarge: 0,
                      }
                    )}
                  </div>
                  <div className='text-muted-foreground mt-0.5 text-[10px] font-medium'>
                    {t('Total earned')}
                  </div>
                </div>
              </div>
            </div>
          </Dialog>
        </>
      ) : null}

      {isAuthenticated ? (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger render={pill} className={className} />
          <PopoverContent align='start' sideOffset={8} className='w-72 p-1.5'>
            <button
              type='button'
              className='hover:bg-accent flex w-full items-center gap-3 rounded-lg p-2.5 text-left outline-none'
              onClick={() => {
                setPopoverOpen(false)
                setDialogOpen(true)
              }}
            >
              <span className='bg-violet-500/10 text-violet-600 dark:text-violet-400 flex size-9 shrink-0 items-center justify-center rounded-lg'>
                <CalendarCheck className='size-4' />
              </span>
              <span className='min-w-0 flex-1'>
                <span className='flex items-center gap-1.5 text-sm font-semibold'>
                  {t('Daily Check-in')}
                  {checkinEnabled && !checkinStatusLoading && !checkedToday ? (
                    <span className='size-1.5 rounded-full bg-red-500' />
                  ) : null}
                </span>
                <span className='text-muted-foreground block truncate text-xs'>
                  {checkedToday
                    ? `${t('Checked in')}${todayAward !== undefined ? ` · +${formatQuotaWithCurrency(todayAward)}` : ''}`
                    : t('Check in daily to receive random quota rewards')}
                </span>
              </span>
              <ChevronRight className='text-muted-foreground size-4 shrink-0' />
            </button>

            <button
              type='button'
              className='hover:bg-accent flex w-full items-center gap-3 rounded-lg p-2.5 text-left outline-none'
              onClick={() => {
                setPopoverOpen(false)
                navigate({ to: '/invite' })
              }}
            >
              <span className='bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 flex size-9 shrink-0 items-center justify-center rounded-lg'>
                <Users className='size-4' />
              </span>
              <span className='min-w-0 flex-1'>
                <span className='flex items-center gap-1.5 text-sm font-semibold'>
                  {t('Invite & Earn')}
                  {pendingRewards > 0 ? (
                    <span className='size-1.5 rounded-full bg-red-500' />
                  ) : null}
                </span>
                <span className='text-muted-foreground block truncate text-xs'>
                  {pendingRewards > 0
                    ? `${t('Pending rewards')} ${formatQuota(pendingRewards)}`
                    : t(
                        'Earn rewards when your invitees register and use the service.'
                      )}
                </span>
              </span>
              <ChevronRight className='text-muted-foreground size-4 shrink-0' />
            </button>
          </PopoverContent>
        </Popover>
      ) : (
        <span className={cn('inline-flex', className)}>{pill}</span>
      )}
    </>
  )
}
