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
import { Link } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle2, Download, ExternalLink } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { PageTransition } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import {
  GatewayCta,
  ResourceBackdrop,
  ResourceCard,
  SnippetBlock,
} from './components'
import { RESOURCES } from './data'
import {
  KIND_STYLES,
  findResourceBySlug,
  pickLocalized,
  pickLocalizedList,
} from './lib'

const KIND_LABEL_KEYS = {
  mcp: 'MCP Servers',
  skill: 'Agent Skills',
  'agent-tool': 'Agent Tools',
} as const

export function ResourceDetail({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const item = findResourceBySlug(slug)

  const related = useMemo(() => {
    if (!item) return []
    return RESOURCES.filter(
      (other) => other.kind === item.kind && other.slug !== item.slug
    ).slice(0, 3)
  }, [item])

  if (!item) return null

  return (
    <div className='relative min-h-dvh'>
      <ResourceBackdrop />
      <PageTransition className='relative mx-auto w-full max-w-4xl px-4 pt-20 pb-16 sm:pt-24'>
        <Link
          to='/resources'
          className='text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors'
        >
          <ArrowLeft aria-hidden className='size-4' />
          {t('Back to Resource Hub')}
        </Link>

        <header className='mt-6 flex items-start gap-4'>
          <span
            className={cn(
              'border-border/50 flex size-14 shrink-0 items-center justify-center rounded-2xl border bg-gradient-to-br',
              KIND_STYLES[item.kind].chip
            )}
          >
            {item.iconName ? (
              getLobeIcon(item.iconName, 30)
            ) : (
              <span className='text-foreground/70 text-2xl font-semibold'>
                {item.name.charAt(0).toUpperCase()}
              </span>
            )}
          </span>
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2.5'>
              <h1 className='text-2xl font-bold tracking-tight sm:text-3xl'>
                {item.name}
              </h1>
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 font-mono text-[11px] tracking-wide',
                  KIND_STYLES[item.kind].badge
                )}
              >
                {t(KIND_LABEL_KEYS[item.kind])}
              </span>
              <span className='border-border/60 text-muted-foreground rounded-full border px-2.5 py-1 text-[11px]'>
                {t(item.vendor)}
              </span>
            </div>
            <p className='text-muted-foreground mt-2 text-sm leading-relaxed sm:text-base'>
              {pickLocalized(item.summary, language)}
            </p>
          </div>
        </header>

        <Card className='mt-6 gap-3 px-5 py-5'>
          <p className='text-sm leading-relaxed sm:text-[15px]'>
            {pickLocalized(item.description, language)}
          </p>
          <div className='mt-1 flex flex-wrap gap-2'>
            {item.tags.map((tag) => (
              <span
                key={tag}
                className='bg-muted/50 text-muted-foreground rounded-full px-2.5 py-0.5 font-mono text-[11px]'
              >
                #{tag}
              </span>
            ))}
          </div>
        </Card>

        <section className='mt-4'>
          <h2 className='text-sm font-semibold tracking-wide'>
            {t('Highlights')}
          </h2>
          <ul className='mt-2.5 grid gap-2 sm:grid-cols-3'>
            {pickLocalizedList(item.highlights, language).map((highlight) => (
              <li
                key={highlight}
                className='border-border/60 bg-card/50 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed'
              >
                <CheckCircle2
                  aria-hidden
                  className='text-primary mt-0.5 size-3.5 shrink-0'
                />
                {highlight}
              </li>
            ))}
          </ul>
        </section>

        {item.installCommand ? (
          <section className='mt-4'>
            <h2 className='text-sm font-semibold tracking-wide'>
              {t('Install command')}
            </h2>
            <SnippetBlock
              className='mt-2.5'
              label='terminal'
              code={item.installCommand}
            />
          </section>
        ) : null}

        {item.downloadUrl || item.repoUrl ? (
          <div className='mt-5 flex flex-wrap items-center gap-2.5'>
            {item.downloadUrl ? (
              <Button
                render={
                  <a
                    href={item.downloadUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                  />
                }
              >
                <Download aria-hidden className='size-4' />
                {t('Download')}
              </Button>
            ) : null}
            {item.repoUrl ? (
              <Button
                variant='outline'
                render={
                  <a
                    href={item.repoUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                  />
                }
              >
                {t('Source repository')}
                <ExternalLink aria-hidden className='size-3.5' />
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className='mt-6'>
          <GatewayCta />
        </div>

        {related.length > 0 ? (
          <section className='mt-10'>
            <h2 className='text-sm font-semibold tracking-wide'>
              {t('Related resources')}
            </h2>
            <div className='mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
              {related.map((other) => (
                <ResourceCard key={other.slug} item={other} />
              ))}
            </div>
          </section>
        ) : null}
      </PageTransition>
    </div>
  )
}
