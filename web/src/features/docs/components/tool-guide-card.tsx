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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { TitledCard } from '@/components/ui/titled-card'

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

export function ToolGuideCard(props: ToolGuideCardProps) {
  const { t } = useTranslation()

  return (
    <div
      id={props.anchorId}
      className={props.anchorId != null ? 'scroll-mt-24' : undefined}
    >
      <TitledCard
        icon={props.logo}
        title={
          <span className='flex flex-wrap items-center gap-2'>
            {props.name}
            {props.recommended === true && (
              <Badge variant='secondary'>{t('Recommended')}</Badge>
            )}
          </span>
        }
        description={props.intro}
      >
        <StepList steps={props.steps} />
        {props.footnote != null && (
          <p className='text-muted-foreground mt-4 text-xs'>{props.footnote}</p>
        )}
      </TitledCard>
    </div>
  )
}
