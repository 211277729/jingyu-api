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
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { KIND_STYLES } from '@/features/resources/lib'
import type { ResourceKind } from '@/features/resources/types'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { ResourceAdminItem } from '../types'
import { DataTableRowActions } from './data-table-row-actions'
import { ResourceAvatar } from './resource-avatar'
import { ResourceEnabledSwitch } from './resource-enabled-switch'

/** kind → 徽标文案的 i18n key，与资源广场保持一致 */
const KIND_LABEL_KEYS: Record<ResourceKind, string> = {
  mcp: 'MCP Servers',
  skill: 'Agent Skills',
  'agent-tool': 'Agent Tools',
}

export function useResourcesColumns(): ColumnDef<ResourceAdminItem>[] {
  const { t } = useTranslation()
  return [
    {
      accessorKey: 'name',
      header: t('Name'),
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <div className='flex min-w-[180px] items-center gap-2.5'>
          <ResourceAvatar row={row.original} />
          <div className='min-w-0'>
            <div className='truncate font-medium'>{row.original.name}</div>
            <div className='text-muted-foreground truncate font-mono text-xs'>
              {row.original.slug}
            </div>
          </div>
        </div>
      ),
      size: 240,
    },
    {
      accessorKey: 'kind',
      header: t('Category'),
      meta: { mobileBadge: true },
      cell: ({ row }) => (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide whitespace-nowrap',
            KIND_STYLES[row.original.kind].badge
          )}
        >
          {t(KIND_LABEL_KEYS[row.original.kind])}
        </span>
      ),
      filterFn: (row, _id, value: unknown) => {
        const selected = Array.isArray(value) ? value : [value]
        return selected.includes(row.original.kind)
      },
      size: 120,
    },
    {
      accessorKey: 'vendor',
      header: t('Source'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <Badge variant='secondary'>
          {row.original.vendor === 'Official' ? t('Official') : t('Community')}
        </Badge>
      ),
      size: 100,
    },
    {
      accessorKey: 'sort_order',
      header: t('Sort'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <span className='font-mono text-sm'>{row.original.sort_order}</span>
      ),
      size: 80,
    },
    {
      accessorKey: 'enabled',
      header: t('Published'),
      meta: { mobileTitle: t('Published') },
      cell: ({ row }) => <ResourceEnabledSwitch row={row.original} />,
      filterFn: (row, _id, value: unknown) => {
        const selected = Array.isArray(value) ? value : [value]
        return selected.includes(String(row.original.enabled))
      },
      size: 100,
    },
    {
      accessorKey: 'updated_at',
      header: t('Updated'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <div className='min-w-[140px] font-mono text-sm'>
          {formatTimestamp(row.original.updated_at)}
        </div>
      ),
      size: 160,
    },
    {
      id: 'actions',
      header: () => t('Actions'),
      cell: ({ row }) => <DataTableRowActions row={row} />,
      meta: { pinned: 'right' as const },
    },
  ]
}
