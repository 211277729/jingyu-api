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
import { ArrowDownToLine, Coins, Users, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import type { UserWalletData } from '@/features/wallet/types'
import { formatQuotaWithCurrency } from '@/lib/currency'

interface InviteRewardsCardProps {
  user: UserWalletData | null
  loading?: boolean
  transferring?: boolean
  complianceConfirmed?: boolean
  hasTopupRebate?: boolean
  onTransfer: () => void
}

export function InviteRewardsCard({
  user,
  loading,
  transferring,
  complianceConfirmed = true,
  hasTopupRebate = false,
  onTransfer,
}: InviteRewardsCardProps) {
  const { t } = useTranslation()
  const hasRewards = (user?.aff_quota ?? 0) > 0

  const stats = [
    {
      label: t('Pending rewards'),
      value: formatQuotaWithCurrency(user?.aff_quota ?? 0),
      icon: Coins,
      accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
    {
      label: t('Total rewards earned'),
      value: formatQuotaWithCurrency(user?.aff_history_quota ?? 0),
      icon: Wallet,
      accent: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    },
    {
      label: t('Users invited'),
      value: String(user?.aff_count ?? 0),
      icon: Users,
      accent: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    },
  ]

  return (
    <TitledCard
      disableHoverEffect
      title={
        <span className='flex items-center gap-2'>
          <Coins className='size-4' />
          {t('My rewards')}
        </span>
      }
      action={
        hasRewards ? (
          <Button
            size='sm'
            onClick={onTransfer}
            disabled={!complianceConfirmed || transferring}
          >
            <ArrowDownToLine className='size-3.5' />
            {t('Transfer to Balance')}
          </Button>
        ) : null
      }
    >
      {loading ? (
        <div className='grid grid-cols-3 gap-3 p-4 sm:p-5'>
          {[0, 1, 2].map((key) => (
            <div key={key} className='space-y-2'>
              <Skeleton className='h-3 w-full' />
              <Skeleton className='h-6 w-2/3' />
            </div>
          ))}
        </div>
      ) : (
        <div className='space-y-4 p-4 sm:p-5'>
          <div className='grid grid-cols-3 gap-3'>
            {stats.map((stat) => (
              <div
                key={stat.label}
                className='bg-muted/30 rounded-xl border p-3'
              >
                <span
                  className={`mb-2 flex size-7 items-center justify-center rounded-lg ${stat.accent}`}
                >
                  <stat.icon className='size-3.5' />
                </span>
                <div className='text-muted-foreground truncate text-[10px] font-medium tracking-wider uppercase'>
                  {stat.label}
                </div>
                <div className='mt-0.5 truncate text-lg font-semibold tabular-nums'>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {!complianceConfirmed ? (
            <p className='text-muted-foreground text-xs'>
              {t(
                'Referral reward transfer is disabled until the administrator confirms compliance terms.'
              )}
            </p>
          ) : null}

          <div className='bg-muted/30 text-muted-foreground rounded-xl border p-3 text-xs'>
            <div className='text-foreground mb-1.5 text-xs font-semibold'>
              {t('How it works')}
            </div>
            <ul className='list-disc space-y-1 pl-5'>
              <li>{t('Share your invite link with friends.')}</li>
              <li>{t('Both of you receive the reward instantly.')}</li>
              {hasTopupRebate ? (
                <li>
                  {t(
                    'You also earn a percentage rebate on every top-up your friends make.'
                  )}
                </li>
              ) : null}
              <li>
                {t('Transfer accumulated rewards to your balance anytime.')}
              </li>
            </ul>
          </div>
        </div>
      )}
    </TitledCard>
  )
}
