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
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { cn } from '@/lib/utils'

import { CategoryNav, NavSearch, SiteCard } from './components'
import { NAV_CATEGORIES, NAV_SITE_COUNT } from './constants'
import { categoryElementId, scrollToAnchor, siteElementId } from './lib/anchors'
import { hitAnchorId, type NavSearchHit } from './lib/search'

const HIGHLIGHT_MS = 2400

export function NavDirectory() {
  const { t } = useTranslation()
  const [activeId, setActiveId] = useState(NAV_CATEGORIES[0].id)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const highlightTimer = useRef<number | null>(null)

  // Scroll to a match and flash it so the jump is visible, not just a landing.
  const focusAnchor = useCallback((anchorId: string) => {
    scrollToAnchor(anchorId)
    setHighlightId(anchorId)
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current)
    highlightTimer.current = window.setTimeout(() => {
      setHighlightId(null)
      highlightTimer.current = null
    }, HIGHLIGHT_MS)
  }, [])

  useEffect(
    () => () => {
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current)
    },
    []
  )

  const handlePreview = useCallback(
    (hit: NavSearchHit | null) => {
      if (hit) focusAnchor(hitAnchorId(hit))
    },
    [focusAnchor]
  )

  const handleSelect = useCallback(
    (hit: NavSearchHit) => focusAnchor(hitAnchorId(hit)),
    [focusAnchor]
  )

  // Highlight the category whose section currently owns the viewport.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible.length > 0) {
          setActiveId(visible[0].target.id.replace('nav-category-', ''))
        }
      },
      { rootMargin: '-96px 0px -55% 0px' }
    )

    NAV_CATEGORIES.forEach((category) => {
      const section = document.querySelector(
        `#${CSS.escape(categoryElementId(category.id))}`
      )
      if (section) observer.observe(section)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <PublicLayout showMainContainer={false}>
      <div className='relative'>
        <div
          aria-hidden
          className='pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-20 dark:opacity-[0.10]'
          style={{
            background: [
              'radial-gradient(ellipse 60% 50% at 20% 20%, oklch(0.72 0.18 250 / 80%) 0%, transparent 70%)',
              'radial-gradient(ellipse 50% 40% at 80% 15%, oklch(0.65 0.15 200 / 60%) 0%, transparent 70%)',
            ].join(', '),
            maskImage:
              'linear-gradient(to bottom, black 40%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, black 40%, transparent 100%)',
          }}
        />

        <PageTransition className='relative mx-auto w-[92%] max-w-[1440px] pt-16 pb-16 sm:pt-20 lg:w-[80%]'>
          <header className='space-y-2'>
            <h1 className='text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.15] font-bold tracking-tight'>
              {t('AI Navigation')}
            </h1>
            <p className='text-muted-foreground/80 max-w-2xl text-sm'>
              {t(
                'A curated directory of AI tools, models and communities, grouped by what you want to get done.'
              )}
            </p>
            <p className='text-muted-foreground/60 text-xs'>
              {t('{{categories}} categories', {
                categories: NAV_CATEGORIES.length,
              })}
              <span aria-hidden> · </span>
              {t('{{sites}} sites', { sites: NAV_SITE_COUNT })}
            </p>
          </header>

          <div className='sticky top-20 z-30 mt-6 flex justify-center'>
            <NavSearch
              categories={NAV_CATEGORIES}
              onPreview={handlePreview}
              onSelect={handleSelect}
              className='w-full max-w-xl'
            />
          </div>

          <div className='mt-8 flex flex-col gap-6 lg:mt-10 lg:flex-row lg:gap-8'>
            <aside className='lg:w-52 lg:shrink-0'>
              <div className='lg:sticky lg:top-24'>
                <CategoryNav categories={NAV_CATEGORIES} activeId={activeId} />
              </div>
            </aside>

            <div className='min-w-0 flex-1 space-y-10'>
              {NAV_CATEGORIES.map((category) => {
                const sectionId = categoryElementId(category.id)
                const categoryHighlighted = highlightId === sectionId

                return (
                  <section
                    key={category.id}
                    id={sectionId}
                    className={cn(
                      'scroll-mt-40 rounded-2xl transition-colors duration-300',
                      categoryHighlighted &&
                        'bg-primary/5 ring-primary/20 -m-2 p-2 ring-1'
                    )}
                  >
                    <div className='mb-3 flex items-baseline gap-2'>
                      <h2 className='text-base font-semibold tracking-tight'>
                        {t(category.labelKey)}
                      </h2>
                      <span className='text-muted-foreground text-xs tabular-nums'>
                        {category.sites.length}
                      </span>
                    </div>
                    <div className='grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3'>
                      {category.sites.map((site) => (
                        <SiteCard
                          key={`${category.id}:${site.url}`}
                          site={site}
                          highlighted={highlightId === siteElementId(site.url)}
                        />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        </PageTransition>
      </div>
    </PublicLayout>
  )
}
