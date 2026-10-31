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
import { Coins, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import { formatQuota } from '@/lib/format'

import type { UserWalletData } from '@/features/wallet/types'

interface InviteRewardsCardProps {
  user: UserWalletData | null
  loading?: boolean
  transferring?: boolean
  complianceConfirmed?: boolean
  onTransfer: () => void
}

export function InviteRewardsCard({
  user,
  loading,
  transferring,
  complianceConfirmed = true,
  onTransfer,
}: InviteRewardsCardProps) {
  const { t } = useTranslation()
  const hasRewards = (user?.aff_quota ?? 0) > 0

  const stats = [
    {
      label: t('Pending rewards'),
      value: formatQuota(user?.aff_quota ?? 0),
      icon: Coins,
    },
    {
      label: t('Total rewards earned'),
      value: formatQuota(user?.aff_history_quota ?? 0),
      icon: Coins,
    },
    {
      label: t('Users invited'),
      value: String(user?.aff_count ?? 0),
      icon: Users,
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
                className='bg-muted/30 rounded-lg border p-3 text-center sm:text-left'
              >
                <div className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
                  {stat.label}
                </div>
                <div className='mt-1 truncate text-lg font-semibold tabular-nums'>
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

          <div className='bg-muted/30 text-muted-foreground rounded-lg border p-3 text-xs'>
            <div className='mb-1.5 text-foreground text-xs font-semibold'>
              {t('How it works')}
            </div>
            <ul className='list-disc space-y-1 pl-5'>
              <li>{t('Share your invite link with friends.')}</li>
              <li>
                {t(
                  'Earn rewards when your invitees register and use the service.'
                )}
              </li>
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
