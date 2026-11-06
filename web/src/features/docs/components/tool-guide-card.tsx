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
import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { StepList, type StepItem } from './step-list'

export type ToolGuideSnippet = StepItem['snippet']
export type ToolGuideStep = StepItem

interface ToolGuideCardProps {
  name: string
  logo: ReactNode
  intro: string
  steps: ToolGuideStep[]
  /** Marks the setup path the page recommends over the manual ones. */
  recommended?: boolean
  /** Anchor target so other page elements can deep-link to this card. */
  anchorId?: string
  footnote?: string
}

/**
 * One tool's setup card on the immersive dark docs console. Custom card
 * chrome (not TitledCard) so the palette stays fixed-dark regardless of the
 * site theme.
 */
export function ToolGuideCard(props: ToolGuideCardProps) {
  const { t } = useTranslation()

  return (
    <div
      id={props.anchorId}
      className={cn(
        'ring-white/10 bg-white/[0.03] rounded-2xl p-5 ring-1 backdrop-blur-sm sm:p-6',
        props.anchorId != null && 'scroll-mt-24'
      )}
    >
      <div className='flex flex-wrap items-center gap-3'>
        <span
          className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-zinc-200 ring-1 ring-white/15 [&>svg]:size-4'
          aria-hidden='true'
        >
          {props.logo}
        </span>
        <h3 className='text-lg font-semibold text-white'>{props.name}</h3>
        {props.recommended === true && (
          <span className='rounded-full bg-gradient-to-r from-violet-500/25 to-cyan-400/25 px-2.5 py-0.5 text-[11px] font-semibold text-violet-200 ring-1 ring-violet-400/40'>
            {t('Recommended')}
          </span>
        )}
      </div>
      <p className='mt-2.5 text-sm leading-relaxed text-zinc-400'>
        {props.intro}
      </p>
      <div className='mt-5'>
        <StepList steps={props.steps} />
      </div>
      {props.footnote != null && (
        <p className='mt-5 flex items-start gap-1.5 text-xs leading-relaxed text-zinc-500'>
          <Info className='mt-0.5 size-3.5 shrink-0' aria-hidden='true' />
          {props.footnote}
        </p>
      )}
    </div>
  )
}
