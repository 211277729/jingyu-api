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
import { ArrowUpRight } from 'lucide-react'
import { useState } from 'react'

import { Card } from '@/components/ui/card'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { siteElementId } from '../lib/anchors'
import type { NavSite } from '../types'

/** Display host of the destination, so a card never shows a full URL. */
function readHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

const FAVICON_SIZE = 22

/** Initial-letter badge, matching the lobe-icon loader's fallback style. */
function LetterBadge({ name }: { name: string }) {
  return (
    <span
      className='bg-muted text-muted-foreground flex items-center justify-center rounded-full text-xs font-medium'
      style={{ width: FAVICON_SIZE, height: FAVICON_SIZE }}
    >
      {name.charAt(0).toUpperCase() || '?'}
    </span>
  )
}

/**
 * Long-tail sites have no lobe icon, so try the destination's own favicon;
 * sites without one (or without an absolute origin) keep the letter badge.
 */
function FaviconAvatar({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false)

  let faviconUrl: string | null = null
  try {
    faviconUrl = `${new URL(url).origin}/favicon.ico`
  } catch {
    faviconUrl = null
  }

  if (!faviconUrl || failed) return <LetterBadge name={name} />

  return (
    <img
      src={faviconUrl}
      alt=''
      aria-hidden='true'
      width={FAVICON_SIZE}
      height={FAVICON_SIZE}
      loading='lazy'
      decoding='async'
      onError={() => setFailed(true)}
      className='rounded-full object-contain'
    />
  )
}

function SiteAvatar(props: { site: NavSite }) {
  if (props.site.iconName) {
    return <>{getLobeIcon(props.site.iconName, FAVICON_SIZE)}</>
  }
  return <FaviconAvatar url={props.site.url} name={props.site.name} />
}

export function SiteCard(props: { site: NavSite; highlighted?: boolean }) {
  return (
    <a
      id={siteElementId(props.site.url)}
      href={props.site.url}
      target='_blank'
      rel='noopener noreferrer'
      className='group/site focus-visible:ring-ring/40 scroll-mt-40 rounded-xl focus-visible:ring-2 focus-visible:outline-none'
    >
      <Card
        size='sm'
        className={cn(
          'group-hover/site:border-primary/25 group-hover/site:ring-primary/25 group-hover/site:bg-muted/20 group-hover/site:shadow-primary/10 group-hover/site:shadow-lg h-full flex-row items-center gap-3 px-3.5 py-3 transition-all duration-200 group-hover/site:-translate-y-0.5',
          props.highlighted &&
            'ring-primary/60 bg-primary/5 ring-2 transition-none'
        )}
      >
        <span className='border-border/50 bg-background/60 flex size-8 shrink-0 items-center justify-center rounded-full border'>
          <SiteAvatar site={props.site} />
        </span>
        <span className='flex min-w-0 flex-1 flex-col'>
          <span className='truncate text-sm font-medium'>
            {props.site.name}
          </span>
          <span className='text-muted-foreground truncate text-xs'>
            {readHost(props.site.url)}
          </span>
        </span>
        <ArrowUpRight
          aria-hidden='true'
          size={14}
          className='text-muted-foreground/80 group-hover/site:text-primary -translate-x-0.5 translate-y-0.5 opacity-0 transition-all duration-200 group-hover/site:translate-x-0 group-hover/site:translate-y-0 group-hover/site:opacity-100'
        />
      </Card>
    </a>
  )
}
