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
import { Gift, Percent, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { formatQuotaWithCurrency } from '@/lib/currency'

interface InviteHeroProps {
  inviterQuota: number
  inviteeQuota: number
  rebateFirstPercent: number
  rebatePercent: number
  rebateFirstDays: number
}

/** 10 → "10"，10.5 → "10.5" */
function formatPercent(value: number): string {
  return String(Number(value.toFixed(2)))
}

/**
 * Gradient hero banner for the invite page. Shouts the concrete reward
 * amounts (fixed sign-up bonuses from system settings) plus the top-up
 * rebate percentages, so visitors instantly see what an invitation is
 * worth — visual only, no extra data fetching.
 */
export function InviteHero({
  inviterQuota,
  inviteeQuota,
  rebateFirstPercent,
  rebatePercent,
  rebateFirstDays,
}: InviteHeroProps) {
  const { t } = useTranslation()
  const hasAmounts = inviterQuota > 0 || inviteeQuota > 0
  const hasFirstRebate = rebateFirstPercent > 0
  const hasRebate = rebatePercent > 0
  const hasRebates = hasFirstRebate || hasRebate

  return (
    <div className='relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-500 p-6 text-white sm:p-8'>
      {/* Decorative glows and rings */}
      <div className='pointer-events-none absolute -top-16 -right-10 size-52 rounded-full bg-white/10 blur-2xl' />
      <div className='pointer-events-none absolute -bottom-24 -left-10 size-56 rounded-full bg-fuchsia-300/20 blur-2xl' />
      <div className='pointer-events-none absolute top-5 right-36 hidden size-20 rounded-full border border-white/15 sm:block' />
      <div className='pointer-events-none absolute right-10 bottom-4 hidden size-3 rounded-full bg-white/40 sm:block' />
      <div className='pointer-events-none absolute top-10 right-16 hidden size-2 rounded-full bg-white/50 sm:block' />

      <div className='relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between'>
        <div className='max-w-2xl space-y-3'>
          <div className='inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide backdrop-blur'>
            <Sparkles className='size-3' />
            {t('Invite & Earn')}
          </div>
          <h2 className='text-2xl leading-tight font-bold tracking-tight sm:text-3xl'>
            {t('Invite friends, earn rewards together')}
          </h2>
          {hasAmounts ? (
            <p className='text-sm text-white/85'>
              {t(
                'For each friend who signs up through your link, you earn {{inviter}} and they get {{invitee}}.',
                {
                  inviter: formatQuotaWithCurrency(inviterQuota),
                  invitee: formatQuotaWithCurrency(inviteeQuota),
                }
              )}
            </p>
          ) : null}
          {hasRebates ? (
            <p className='text-sm text-white/85'>
              {hasFirstRebate && hasRebate
                ? t(
                    'On top of that, earn {{first}}% of your friend’s first top-up and {{percent}}% of every top-up after.',
                    {
                      first: formatPercent(rebateFirstPercent),
                      percent: formatPercent(rebatePercent),
                    }
                  )
                : t(
                    'On top of that, earn {{percent}}% of every top-up your friends make.',
                    {
                      percent: formatPercent(
                        hasFirstRebate ? rebateFirstPercent : rebatePercent
                      ),
                    }
                  )}
              {hasFirstRebate && rebateFirstDays > 0 ? (
                <span className='text-white/70'>
                  {' '}
                  {t(
                    '(First top-up rebate applies within {{days}} days of signing up.)',
                    { days: rebateFirstDays }
                  )}
                </span>
              ) : null}
            </p>
          ) : null}
          <div className='flex flex-wrap items-center gap-2 pt-1'>
            {hasAmounts ? (
              <>
                <span className='inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur'>
                  <Gift className='size-3.5' />
                  {t('You get {{quota}}', {
                    quota: formatQuotaWithCurrency(inviterQuota),
                  })}
                </span>
                <span className='inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold backdrop-blur'>
                  <Gift className='size-3.5' />
                  {t('Friend gets {{quota}}', {
                    quota: formatQuotaWithCurrency(inviteeQuota),
                  })}
                </span>
              </>
            ) : null}
            {hasFirstRebate ? (
              <span className='inline-flex items-center gap-1.5 rounded-full bg-amber-300/90 px-3 py-1.5 text-xs font-semibold text-amber-950'>
                <Percent className='size-3.5' />
                {t('First top-up rebate {{percent}}%', {
                  percent: formatPercent(rebateFirstPercent),
                })}
              </span>
            ) : null}
            {hasRebate ? (
              <span className='inline-flex items-center gap-1.5 rounded-full bg-amber-300/90 px-3 py-1.5 text-xs font-semibold text-amber-950'>
                <Percent className='size-3.5' />
                {t('Recurring rebate {{percent}}%', {
                  percent: formatPercent(rebatePercent),
                })}
              </span>
            ) : null}
          </div>
        </div>

        <div className='relative hidden shrink-0 sm:block'>
          <div className='grid size-24 place-items-center rounded-3xl bg-white/15 shadow-inner backdrop-blur'>
            <Gift className='size-12' />
          </div>
          <div className='absolute -top-2 -right-2 grid size-8 place-items-center rounded-full bg-amber-300 text-sm font-bold text-amber-900 shadow-lg'>
            $
          </div>
        </div>
      </div>
    </div>
  )
}
