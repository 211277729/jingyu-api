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
import { Search, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BackToTopButton } from '@/components/back-to-top-button'
import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { useResourcesQuery } from './api'
import { ResourceBackdrop, ResourceGallery } from './components'
import { EMPTY_RESOURCES, filterResources, RESOURCE_KIND_TABS } from './lib'
import type { ResourceKind } from './types'

export function Resources() {
  const { t } = useTranslation()
  const [kind, setKind] = useState<'all' | ResourceKind>('all')
  const [query, setQuery] = useState('')
  const { data, isLoading, isError, refetch } = useResourcesQuery()
  const items = data ?? EMPTY_RESOURCES

  const counts = useMemo(() => {
    return {
      mcp: items.filter((item) => item.kind === 'mcp').length,
      skill: items.filter((item) => item.kind === 'skill').length,
      'agent-tool': items.filter((item) => item.kind === 'agent-tool').length,
      total: items.length,
    }
  }, [items])

  const filtered = useMemo(
    () => filterResources(items, kind, query),
    [items, kind, query]
  )

  const statItems = useMemo(
    () => [
      { label: t('MCP Servers'), value: counts.mcp },
      { label: t('Agent Skills'), value: counts.skill },
      { label: t('Agent Tools'), value: counts['agent-tool'] },
      { label: t('Total resources'), value: counts.total },
    ],
    [t, counts]
  )

  return (
    <PublicLayout showMainContainer={false}>
      <div className='relative'>
        <ResourceBackdrop />
        <PageTransition className='relative mx-auto w-full max-w-[1800px] px-3 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10 xl:px-8'>
          <header className='mx-auto mb-6 max-w-3xl pt-4 text-center sm:mb-10 sm:pt-10'>
            <div className='border-border/60 bg-background/60 mx-auto inline-flex items-center gap-2 rounded-full border px-3 py-1 shadow-sm backdrop-blur-sm'>
              <Sparkles aria-hidden className='text-primary size-3' />
              <span className='text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase'>
                {t('Curated & ready to use')}
              </span>
            </div>
            <h1 className='mt-4 bg-gradient-to-r from-[#3b82f6] via-[#6d5cf5] to-[#a855f7] bg-clip-text text-[clamp(2.1rem,5.5vw,3.6rem)] leading-[1.12] font-bold tracking-tight text-transparent sm:mt-5 dark:from-[#60a5fa] dark:via-[#8f7bff] dark:to-[#c084fc]'>
              {t('Resource Hub')}
            </h1>
            <p className='text-muted-foreground/60 mx-auto mt-3 max-w-2xl text-xs leading-relaxed sm:mt-4 sm:text-sm'>
              {t(
                'Ready-to-use MCP servers, agent skills and AI tools. Grab what you need, install it in your own client, and ship faster.'
              )}
            </p>
            <div className='relative mx-auto mt-5 max-w-2xl sm:mt-7'>
              <Search
                aria-hidden
                className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2'
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('Search resources, tags or keywords...')}
                className='bg-background/60 h-10 pr-4 pl-9 backdrop-blur-sm'
              />
            </div>

            {/* 数据读数条 */}
            <dl className='mx-auto mt-5 grid max-w-2xl grid-cols-2 gap-2 sm:mt-7 sm:grid-cols-4 sm:gap-3'>
              {statItems.map((item, index) => (
                <div
                  key={item.label}
                  className={cn(
                    'border-border/60 bg-card/50 relative overflow-hidden rounded-xl border px-3 py-2.5 text-left backdrop-blur-sm',
                    'transition-colors hover:border-primary/40'
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'absolute inset-y-3 left-0 w-0.5 rounded-full',
                      index % 2 === 0 ? 'bg-primary/60' : 'bg-chart-2/60'
                    )}
                  />
                  <dd className='font-mono text-xl leading-none font-semibold tabular-nums'>
                    {item.value.toLocaleString()}
                  </dd>
                  <dt className='text-muted-foreground mt-1.5 text-[11px] tracking-wide'>
                    {item.label}
                  </dt>
                </div>
              ))}
            </dl>
          </header>

          {/* 类别 Tab + 计数 */}
          <div className='mb-5 flex flex-wrap items-center justify-center gap-2'>
            {RESOURCE_KIND_TABS.map((tab) => {
              const count = tab.id === 'all' ? counts.total : counts[tab.id]
              const active = kind === tab.id
              return (
                <button
                  key={tab.id}
                  type='button'
                  onClick={() => setKind(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors sm:text-sm',
                    active
                      ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
                      : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground border-border/60 bg-background/40'
                  )}
                >
                  {t(tab.labelKey)}
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums',
                      active ? 'bg-primary/15' : 'bg-muted/60'
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>

          <ResourceGallery
            isLoading={isLoading}
            isError={isError}
            items={items}
            filtered={filtered}
            onRetry={() => void refetch()}
            onClearFilters={() => {
              setQuery('')
              setKind('all')
            }}
          />
        </PageTransition>
        <BackToTopButton />
      </div>
    </PublicLayout>
  )
}
