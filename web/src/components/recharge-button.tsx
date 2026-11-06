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
import { Link } from '@tanstack/react-router'
import { Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

/**
 * The "Recharge | balance" pill shown next to the Daily Rewards entry.
 *
 * Only rendered for signed-in users; clicking it opens the wallet page
 * (where top-up happens) in a new browser tab. The balance is a quick
 * glance value from the auth session, the wallet page remains the
 * source of truth.
 */
export function RechargeButton({ className }: { className?: string }) {
  const { t } = useTranslation()
  const quota = useAuthStore((s) => s.auth.user?.quota)

  if (quota === undefined) {
    return null
  }

  return (
    <Button
      variant='outline'
      render={
        <Link
          to='/wallet'
          // 充值属高频参考入口，参照导航约定在新标签打开
          target='_blank'
          rel='noopener noreferrer'
        />
      }
      className={cn(
        'bg-background/80 inline-flex h-8 gap-1.5 rounded-full px-3 text-xs font-semibold shadow-sm',
        // H5 顶栏空间有限，只留钱包图标圆钮
        'max-sm:w-8 max-sm:justify-center max-sm:px-0',
        // 桌面顶栏滚动收缩时压成纯图标圆钮，省出导航宽度
        'group-data-[scrolled]/header:w-8 group-data-[scrolled]/header:justify-center group-data-[scrolled]/header:px-0',
        className
      )}
      aria-label={t('Recharge')}
      title={t('Recharge')}
    >
      <Wallet className='text-primary size-3.5' />
      <span className='group-data-[scrolled]/header:hidden max-sm:hidden'>
        {t('Recharge')}
      </span>
      <span className='bg-border mx-0.5 h-4 w-px group-data-[scrolled]/header:hidden max-sm:hidden' />
      <span className='text-primary tabular-nums group-data-[scrolled]/header:hidden max-sm:hidden'>
        {formatQuota(quota)}
      </span>
    </Button>
  )
}
