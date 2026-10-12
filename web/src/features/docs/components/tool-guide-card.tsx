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

import { CodeBlock } from './code-block'

export type ToolGuideSnippet = {
  /** Optional file path or shell name shown above the snippet. */
  label?: string
  code: string
}

export type ToolGuideStep = {
  text: string
  snippet?: ToolGuideSnippet
}

interface ToolGuideCardProps {
  name: string
  logo: ReactNode
  intro: string
  steps: ToolGuideStep[]
  /** Marks the setup path the page recommends over the manual ones. */
  recommended?: boolean
  footnote?: string
}

export function ToolGuideCard(props: ToolGuideCardProps) {
  const { t } = useTranslation()

  return (
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
      <ol className='space-y-5'>
        {props.steps.map((step, index) => (
          <li key={step.text} className='flex gap-3'>
            <span
              className='bg-muted text-muted-foreground mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold'
              aria-hidden='true'
            >
              {index + 1}
            </span>
            <div className='min-w-0 flex-1 space-y-2'>
              <p className='text-sm'>{step.text}</p>
              {step.snippet != null && (
                <CodeBlock
                  code={step.snippet.code}
                  label={step.snippet.label}
                />
              )}
            </div>
          </li>
        ))}
      </ol>
      {props.footnote != null && (
        <p className='text-muted-foreground mt-4 text-xs'>{props.footnote}</p>
      )}
    </TitledCard>
  )
}
