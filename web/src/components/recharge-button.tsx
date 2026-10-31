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
import { Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { formatQuota } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

/**
 * The "Recharge | balance" pill shown next to the Super Rewards entry.
 *
 * Only rendered for signed-in users; clicking it jumps to the wallet
 * page where top-up happens. The balance is a quick glance value from
 * the auth session, the wallet page remains the source of truth.
 */
export function RechargeButton({ className }: { className?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const quota = useAuthStore((s) => s.auth.user?.quota)

  if (quota === undefined) {
    return null
  }

  return (
    <Button
      variant='outline'
      onClick={() => navigate({ to: '/wallet' })}
      className={cn(
        'bg-background/80 h-8 gap-1.5 rounded-full px-3 text-xs font-semibold shadow-sm',
        className
      )}
      aria-label={t('Recharge')}
    >
      <Wallet className='text-primary size-3.5' />
      <span>{t('Recharge')}</span>
      <span className='bg-border mx-0.5 h-4 w-px' />
      <span className='text-primary tabular-nums'>{formatQuota(quota)}</span>
    </Button>
  )
}
