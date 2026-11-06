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

import { cn } from '@/lib/utils'

interface DocsSectionProps {
  /** Anchor target and table-of-contents key. */
  id: string
  /** Two-digit mono index shown before the title, e.g. `01`. */
  index?: string
  title: string
  description?: string
  icon?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * One documentation section: a glass panel on the immersive dark console.
 *
 * `scroll-mt-24` clears the fixed public header when an anchor is followed.
 */
export function DocsSection(props: DocsSectionProps) {
  return (
    <section
      id={props.id}
      className={cn(
        'ring-white/10 bg-white/[0.03] scroll-mt-24 space-y-5 rounded-3xl p-5 ring-1 backdrop-blur-sm sm:p-8',
        props.className
      )}
    >
      <div className='flex items-start gap-4'>
        {props.index != null && (
          <span
            className='mt-1 font-mono text-xs font-semibold tracking-[0.25em] text-violet-300/90'
            aria-hidden='true'
          >
            {props.index}
          </span>
        )}
        <div className='min-w-0 flex-1 space-y-1.5'>
          <h2 className='flex items-center gap-2.5 text-xl font-semibold tracking-tight text-balance text-white sm:text-2xl'>
            {props.icon != null && (
              <span
                className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/30 [&>svg]:size-4'
                aria-hidden='true'
              >
                {props.icon}
              </span>
            )}
            {props.title}
          </h2>
          {props.description != null && (
            <p className='text-sm leading-relaxed text-zinc-400'>
              {props.description}
            </p>
          )}
        </div>
      </div>
      {props.children}
    </section>
  )
}
