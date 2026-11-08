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
import { Copy } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import { KIND_STYLES, getQuickInstall, pickLocalized } from '../lib'
import type { ResourceItem, ResourceKind } from '../types'

/** kind → 徽标文案的 i18n key */
const KIND_LABEL_KEYS: Record<ResourceKind, string> = {
  mcp: 'MCP Servers',
  skill: 'Agent Skills',
  'agent-tool': 'Agent Tools',
}

function KindBadge({ kind }: { kind: ResourceKind }) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide whitespace-nowrap',
        KIND_STYLES[kind].badge
      )}
    >
      {t(KIND_LABEL_KEYS[kind])}
    </span>
  )
}

/** 图标位：lobe 图标优先，缺省回落首字母徽章（与导航页同约定） */
function ResourceAvatar({
  item,
  size = 40,
}: {
  item: ResourceItem
  size?: number
}) {
  return (
    <span
      className={cn(
        'border-border/50 flex shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br',
        KIND_STYLES[item.kind].chip
      )}
      style={{ width: size, height: size }}
    >
      {item.iconName ? (
        getLobeIcon(item.iconName, Math.round(size * 0.55))
      ) : (
        <span
          className='text-foreground/70 font-semibold'
          style={{ fontSize: Math.round(size * 0.4) }}
        >
          {item.name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  )
}

export function ResourceCard({ item }: { item: ResourceItem }) {
  const { t, i18n } = useTranslation()
  const { copyToClipboard } = useCopyToClipboard()
  const quickInstall = getQuickInstall(item)

  return (
    <Link
      to='/resources/$slug'
      params={{ slug: item.slug }}
      className='group/res focus-visible:ring-ring/40 rounded-xl focus-visible:ring-2 focus-visible:outline-none'
    >
      <Card
        size='sm'
        className='group-hover/res:border-primary/25 group-hover/res:ring-primary/25 group-hover/res:bg-muted/20 group-hover/res:shadow-primary/10 hover:bg-muted/20 h-full flex-col gap-3 px-4 py-4 transition-all duration-200 group-hover/res:-translate-y-0.5 group-hover/res:shadow-lg'
      >
        <div className='flex items-start gap-3'>
          <ResourceAvatar item={item} />
          <div className='min-w-0 flex-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='truncate text-sm font-semibold'>
                {item.name}
              </span>
              <KindBadge kind={item.kind} />
            </div>
            <p className='text-muted-foreground mt-1.5 line-clamp-2 text-xs leading-relaxed'>
              {pickLocalized(item.summary, i18n.language)}
            </p>
          </div>
        </div>

        <div className='mt-auto flex items-end justify-between gap-2'>
          <div className='flex min-w-0 flex-wrap gap-x-2.5 gap-y-1'>
            {item.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className='text-muted-foreground/70 font-mono text-[11px]'
              >
                #{tag}
              </span>
            ))}
          </div>
          {quickInstall ? (
            <Button
              variant='ghost'
              size='icon'
              className='text-muted-foreground size-7 shrink-0'
              title={t('Copy install command')}
              onClick={(event) => {
                // 卡片整体是详情页链接，复制动作不触发跳转
                event.preventDefault()
                event.stopPropagation()
                void copyToClipboard(quickInstall)
              }}
            >
              <Copy className='size-3.5' />
            </Button>
          ) : null}
        </div>
      </Card>
    </Link>
  )
}
