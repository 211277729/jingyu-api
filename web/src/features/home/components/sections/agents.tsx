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
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'
import { resolveDocsTarget } from '@/lib/docs-link'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { AGENT_APPLICATIONS } from '../../constants'

interface AgentsProps {
  className?: string
}

const TILE_CLASSES =
  'group hover:bg-muted/25 flex h-full items-center gap-3 p-4 transition-colors duration-300 md:p-5'

export function Agents(_props: AgentsProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const docs = resolveDocsTarget(status?.docs_link as string | undefined)

  return (
    <section className='relative z-10 px-6 py-24 md:py-28'>
      <div className='mx-auto max-w-6xl'>
        <div className='mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between'>
          <AnimateInView className='max-w-xl'>
            <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
              {t('Agent Ecosystem')}
            </p>
            <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-3xl'>
              {t('Works with coding, office, research and design agents')}
            </h2>
            <p className='text-muted-foreground mt-4 text-sm leading-relaxed'>
              {t(
                'Desktop, terminal and IDE agents connect through one base URL and one key — no per-app gateway.'
              )}
            </p>
          </AnimateInView>

          <AnimateInView delay={100} className='shrink-0'>
            {docs.external ? (
              <Button
                variant='outline'
                className='group border-border/50 hover:border-border hover:bg-muted/50 inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-medium'
                render={
                  <a
                    href={docs.href}
                    target='_blank'
                    rel='noopener noreferrer'
                  />
                }
              >
                <span>{t('View all agents')}</span>
                <ArrowRight className='size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
              </Button>
            ) : (
              <Button
                variant='outline'
                className='group border-border/50 hover:border-border hover:bg-muted/50 inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-medium'
                render={<Link to={docs.href} />}
              >
                <span>{t('View all agents')}</span>
                <ArrowRight className='size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
              </Button>
            )}
          </AnimateInView>
        </div>

        {/* Hairline grid: the cells share one border colour through gap-px. */}
        <div className='border-border/40 bg-border/40 grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-3 lg:grid-cols-4'>
          {AGENT_APPLICATIONS.map((agent, index) => {
            const card = (
              <>
                <span className='flex size-9 shrink-0 items-center justify-center transition-transform duration-300 group-hover:scale-110'>
                  {getLobeIcon(agent.iconName, 26)}
                </span>
                <span className='flex min-w-0 flex-col'>
                  <span className='truncate text-sm font-medium'>
                    {agent.name}
                  </span>
                  <span className='text-muted-foreground mt-0.5 text-[11px]'>
                    {t(agent.categoryKey)}
                  </span>
                </span>
              </>
            )

            return (
              <AnimateInView
                key={agent.name}
                delay={index * 40}
                animation='fade-up'
                className='bg-background h-full'
              >
                {agent.href ? (
                  <a
                    href={agent.href}
                    target='_blank'
                    rel='noopener noreferrer'
                    className={TILE_CLASSES}
                  >
                    {card}
                  </a>
                ) : (
                  <div className={cn(TILE_CLASSES, 'cursor-default')}>
                    {card}
                  </div>
                )}
              </AnimateInView>
            )
          })}
        </div>
      </div>
    </section>
  )
}
