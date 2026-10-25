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
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { categoryElementId, scrollToAnchor } from '../lib/anchors'
import type { NavCategory } from '../types'

export function CategoryNav(props: {
  categories: NavCategory[]
  activeId: string
}) {
  const { t } = useTranslation()

  return (
    <nav
      aria-label={t('AI categories')}
      className='-mx-1 flex [scrollbar-width:none] gap-1 overflow-x-auto pb-2 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden'
    >
      {props.categories.map((category) => {
        const isActive = category.id === props.activeId
        const anchorId = categoryElementId(category.id)

        return (
          <a
            key={category.id}
            href={`#${anchorId}`}
            aria-current={isActive ? 'true' : undefined}
            onClick={(event) => {
              event.preventDefault()
              scrollToAnchor(anchorId)
            }}
            className={cn(
              'focus-visible:ring-ring/40 flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none',
              isActive
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            <span>{t(category.labelKey)}</span>
            <span className='text-xs tabular-nums opacity-60'>
              {category.sites.length}
            </span>
          </a>
        )
      })}
    </nav>
  )
}
