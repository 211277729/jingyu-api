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
/**
 * Directory search field.
 *
 * Owns the query, the ranking and the keyboard model; the page decides what a
 * preview (auto scroll while typing) and a selection (jump and flash) mean.
 */
import { SearchIcon, XIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { searchDirectory, type NavSearchHit } from '../lib/search'
import type { NavCategory } from '../types'

const VISIBLE_RESULTS = 8
const PREVIEW_DELAY_MS = 260

export function NavSearch(props: {
  categories: NavCategory[]
  onPreview: (hit: NavSearchHit | null) => void
  onSelect: (hit: NavSearchHit) => void
  className?: string
}) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  const hits = useMemo(
    () => searchDirectory(props.categories, query, t),
    [props.categories, query, t]
  )
  const visibleHits = hits.slice(0, VISIBLE_RESULTS)

  // Debounced preview: typing slides the page to the best match without
  // waiting for Enter, but a fast typist never triggers a scroll storm.
  const { onPreview } = props
  useEffect(() => {
    if (!query.trim()) {
      onPreview(null)
      return
    }

    const timer = window.setTimeout(() => {
      onPreview(hits[0] ?? null)
    }, PREVIEW_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [query, hits, onPreview])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function select(hit: NavSearchHit) {
    props.onSelect(hit)
    setOpen(false)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      if (query) {
        setQuery('')
        props.onPreview(null)
      }
      setOpen(false)
      return
    }

    if (!visibleHits.length) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => {
        const delta = event.key === 'ArrowDown' ? 1 : -1
        return (index + delta + visibleHits.length) % visibleHits.length
      })
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      select(visibleHits[activeIndex] ?? visibleHits[0])
    }
  }

  const activeHit = visibleHits[activeIndex]

  return (
    <div className={cn('relative', props.className)} ref={rootRef}>
      <SearchIcon
        aria-hidden='true'
        size={16}
        className='text-muted-foreground pointer-events-none absolute start-3 top-1/2 -translate-y-1/2'
      />
      <Input
        type='search'
        value={query}
        role='combobox'
        aria-expanded={open && query.length > 0}
        aria-controls='nav-search-results'
        aria-autocomplete='list'
        aria-activedescendant={
          open && activeHit ? `nav-search-option-${activeIndex}` : undefined
        }
        aria-label={t('Search the directory')}
        placeholder={t('Search tools, categories or sites')}
        className='bg-background h-10 rounded-xl pr-9 pl-9 text-sm shadow-lg ring-1 ring-black/5 dark:ring-white/10 [&::-webkit-search-cancel-button]:hidden'
        onChange={(event) => {
          setQuery(event.target.value)
          setActiveIndex(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {query ? (
        <Button
          variant='ghost'
          size='icon'
          aria-label={t('Clear search')}
          className='text-muted-foreground hover:text-foreground absolute end-1.5 top-1/2 size-7 -translate-y-1/2'
          onClick={() => {
            setQuery('')
            setActiveIndex(0)
            props.onPreview(null)
          }}
        >
          <XIcon aria-hidden='true' size={14} />
        </Button>
      ) : null}

      {open && query.trim() ? (
        <div className='bg-popover ring-border/70 absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-xl shadow-xl ring-1'>
          {visibleHits.length ? (
            <>
              <ul
                id='nav-search-results'
                role='listbox'
                aria-label={t('Search results')}
                className='max-h-80 overflow-y-auto py-1'
              >
                {visibleHits.map((hit, index) => (
                  <li key={hit.key}>
                    <button
                      type='button'
                      id={`nav-search-option-${index}`}
                      role='option'
                      aria-selected={index === activeIndex}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => select(hit)}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition-colors',
                        index === activeIndex
                          ? 'bg-muted/70'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <span className='text-muted-foreground/70 w-10 shrink-0 text-[11px]'>
                        {hit.kind === 'category' ? t('Category') : t('Site')}
                      </span>
                      <span className='min-w-0 flex-1 truncate'>
                        {hit.kind === 'category'
                          ? t(hit.labelKey)
                          : hit.site.name}
                      </span>
                      {hit.kind === 'site' ? (
                        <span className='text-muted-foreground/60 max-w-36 truncate text-xs'>
                          {t(hit.categoryLabelKey)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
              <p className='text-muted-foreground/60 border-border/50 border-t px-3 py-1.5 text-[11px]'>
                {t('{{count}} matches', { count: hits.length })}
                {hits.length > visibleHits.length ? (
                  <span aria-hidden> · </span>
                ) : null}
                {hits.length > visibleHits.length
                  ? t('Press Enter to jump to the best match')
                  : null}
              </p>
            </>
          ) : (
            <p className='text-muted-foreground px-3 py-3 text-sm'>
              {t('No matching tools')}
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
