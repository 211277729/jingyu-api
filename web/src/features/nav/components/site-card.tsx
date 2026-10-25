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
          'group-hover/site:ring-primary/30 group-hover/site:bg-muted/20 h-full flex-row items-center gap-3 px-3.5 py-3 transition-all duration-200 group-hover/site:-translate-y-0.5 group-hover/site:shadow-sm',
          props.highlighted &&
            'ring-primary/60 bg-primary/5 ring-2 transition-none'
        )}
      >
        <span className='flex size-7 shrink-0 items-center justify-center'>
          {getLobeIcon(props.site.iconName || props.site.name, 22)}
        </span>
        <span className='flex min-w-0 flex-col'>
          <span className='truncate text-sm font-medium'>
            {props.site.name}
          </span>
          <span className='text-muted-foreground truncate text-xs'>
            {readHost(props.site.url)}
          </span>
        </span>
      </Card>
    </a>
  )
}
