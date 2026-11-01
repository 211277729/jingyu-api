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
import { Coins, Share2, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * The three-step "how inviting works" strip under the hero. Visual only.
 */
export function InviteSteps() {
  const { t } = useTranslation()

  const steps = [
    {
      icon: Share2,
      title: t('Share your invite link'),
      description: t('Share the link or QR code with friends anywhere.'),
      accent: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    },
    {
      icon: UserPlus,
      title: t('Friend signs up'),
      description: t('Your friend creates an account through your link.'),
      accent: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    },
    {
      icon: Coins,
      title: t('Rewards land instantly'),
      description: t(
        'Both of you receive the reward; transfer it to your balance anytime.'
      ),
      accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    },
  ]

  return (
    <div className='grid gap-3 sm:grid-cols-3'>
      {steps.map((step, index) => (
        <div
          key={step.title}
          className='bg-card relative flex items-start gap-3 rounded-xl border p-4'
        >
          <span
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${step.accent}`}
          >
            <step.icon className='size-4' />
          </span>
          <div className='min-w-0 space-y-0.5'>
            <div className='flex items-center gap-1.5 text-sm font-semibold'>
              <span className='text-muted-foreground/60 text-[10px] font-bold tabular-nums'>
                0{index + 1}
              </span>
              {step.title}
            </div>
            <p className='text-muted-foreground text-xs leading-relaxed'>
              {step.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
