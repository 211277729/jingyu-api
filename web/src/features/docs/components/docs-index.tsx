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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { DOCS_SECTION_IDS, DOCS_SECTION_TITLE_KEYS } from '../constants'

/**
 * "On this page" table of contents.
 *
 * The nav is a direct grid child, so it needs `lg:self-start`: the default
 * `align-items: stretch` would stretch it to the full row height and leave
 * the sticky offset no room to travel. An IntersectionObserver band keeps
 * the section the reader is in highlighted.
 */
export function DocsIndex() {
  const { t } = useTranslation()
  const [activeId, setActiveId] = useState<string>()

  useEffect(() => {
    const els = DOCS_SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el != null
    )
    if (els.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0] != null) setActiveId(visible[0].target.id)
      },
      // The band sits below the fixed header, so a section counts as active
      // once its top enters the upper third of the viewport.
      { rootMargin: '-96px 0px -65% 0px' }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <nav
      aria-label={t('On this page')}
      className='lg:sticky lg:top-24 lg:self-start'
    >
      <p className='text-muted-foreground/70 mb-3 text-xs font-semibold tracking-wide uppercase'>
        {t('On this page')}
      </p>
      <ul className='flex flex-wrap gap-x-4 gap-y-2 lg:flex-col lg:gap-y-2.5'>
        {DOCS_SECTION_IDS.map((id) => (
          <li key={id}>
            <a
              href={`#${id}`}
              aria-current={activeId === id ? 'true' : undefined}
              className={cn(
                'text-sm transition-colors',
                activeId === id
                  ? 'text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t(DOCS_SECTION_TITLE_KEYS[id])}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
