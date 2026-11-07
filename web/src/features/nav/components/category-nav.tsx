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
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import {
  categoryElementId,
  prefersReducedMotion,
  scrollToAnchor,
} from '../lib/anchors'
import type { NavCategory } from '../types'

/**
 * Category navigation in two shapes: a vertical rail beside the content on
 * desktop, and a horizontally scrollable chip strip for the pinned mobile
 * bar, so switching categories never needs a scroll back to the top.
 */
export function CategoryNav(props: {
  categories: NavCategory[]
  activeId: string
  variant?: 'rail' | 'chips'
}) {
  const { t } = useTranslation()
  const activeChipRef = useRef<HTMLAnchorElement>(null)
  const variant = props.variant ?? 'rail'

  // Follow the scroll-spy: keep the newly active chip centered in the strip.
  useEffect(() => {
    if (variant !== 'chips') return
    activeChipRef.current?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      inline: 'center',
      block: 'nearest',
    })
  }, [props.activeId, variant])

  return (
    <nav
      aria-label={t('AI categories')}
      className={cn(
        variant === 'chips'
          ? '[scrollbar-width:none] flex gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden'
          : '-mx-1 flex [scrollbar-width:none] gap-1 overflow-x-auto pb-2 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden'
      )}
    >
      {props.categories.map((category, index) => {
        const isActive = category.id === props.activeId
        const anchorId = categoryElementId(category.id)

        return (
          <a
            key={category.id}
            ref={isActive ? activeChipRef : undefined}
            href={`#${anchorId}`}
            aria-current={isActive ? 'true' : undefined}
            onClick={(event) => {
              event.preventDefault()
              scrollToAnchor(anchorId)
            }}
            className={cn(
              'focus-visible:ring-ring/40 relative flex shrink-0 items-center gap-2.5 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none',
              variant === 'chips'
                ? 'rounded-full border px-3.5 py-1.5 text-[13px]'
                : 'rounded-lg px-3 py-2 text-sm',
              variant === 'chips' && isActive
                ? 'border-primary/40 bg-primary/10 text-primary font-medium'
                : undefined,
              variant === 'chips' && !isActive
                ? 'border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground'
                : undefined,
              variant === 'rail' &&
                (isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground')
            )}
          >
            {variant === 'chips' ? (
              <span className='flex items-center gap-1.5'>
                {t(category.labelKey)}
                <span className='font-mono text-[11px] tabular-nums opacity-60'>
                  {category.sites.length}
                </span>
              </span>
            ) : (
              <>
                {isActive ? (
                  <span
                    aria-hidden
                    className='from-primary to-primary/20 absolute inset-y-1 -left-0.5 w-0.5 rounded-full bg-gradient-to-b'
                  />
                ) : null}
                <span
                  aria-hidden
                  className='w-5 shrink-0 font-mono text-[10px] tabular-nums opacity-50'
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className='flex-1'>{t(category.labelKey)}</span>
                <span className='font-mono text-[11px] tabular-nums opacity-60'>
                  {category.sites.length}
                </span>
              </>
            )}
          </a>
        )
      })}
    </nav>
  )
}
