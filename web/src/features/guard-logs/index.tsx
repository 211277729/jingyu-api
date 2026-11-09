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
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { BadgeCell, DataTablePage, useDataTable } from '@/components/data-table'
import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { formatTimestamp } from '@/lib/format'
import {
  createServerError,
  requireServerSuccess,
} from '@/lib/server-error-message'

import { getGuardLogs, getGuardStats } from './api'
import type { GuardDecision, GuardLogItem } from './types'

const route = getRouteApi('/_authenticated/guard-logs/')

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function GuardLogs() {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const search = route.useSearch()
  const navigate = route.useNavigate()

  const { pagination, onPaginationChange } = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
  })

  const decision = search.decision ?? 0
  const username = search.username ?? ''

  const statsQuery = useQuery({
    queryKey: ['guard-log-stats'],
    queryFn: async () => {
      const result = await getGuardStats()
      if (!result.success) {
        throw createServerError(result, t('Failed to load guard logs'))
      }
      return result.data
    },
    refetchInterval: 30_000,
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'guard-logs',
      decision,
      username,
      pagination.pageIndex + 1,
      pagination.pageSize,
    ],
    queryFn: async () => {
      const result = await getGuardLogs({
        decision: decision as GuardDecision | 0,
        username,
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      })
      if (!result.success) {
        throw createServerError(result, t('Failed to load guard logs'))
      }
      return result.data
    },
    placeholderData: (previousData) => previousData,
  })

  const items = data?.items ?? []

  const columns = useMemo<ColumnDef<GuardLogItem>[]>(
    () => [
      {
        accessorKey: 'created_at',
        header: t('Time'),
        cell: ({ row }) => formatTimestamp(row.original.created_at),
        meta: { mobileTitle: t('Time') },
      },
      {
        accessorKey: 'username',
        header: t('Username'),
        meta: { mobileTitle: t('Username') },
      },
      {
        accessorKey: 'token_name',
        header: t('Token'),
        meta: { mobileTitle: t('Token') },
      },
      {
        accessorKey: 'model',
        header: t('Model'),
        meta: { mobileTitle: t('Model') },
      },
      {
        accessorKey: 'endpoint',
        header: t('Endpoint'),
        meta: { mobileTitle: t('Endpoint') },
      },
      {
        accessorKey: 'body_bytes',
        header: t('Body size'),
        cell: ({ row }) => formatBytes(row.original.body_bytes),
        meta: { mobileTitle: t('Body size') },
      },
      {
        accessorKey: 'estimated_tokens',
        header: t('Estimated tokens'),
        cell: ({ row }) =>
          row.original.estimated_tokens > 0
            ? row.original.estimated_tokens.toLocaleString()
            : '-',
        meta: { mobileTitle: t('Estimated tokens') },
      },
      {
        accessorKey: 'max_tokens',
        header: t('Threshold'),
        cell: ({ row }) => row.original.max_tokens.toLocaleString(),
        meta: { mobileTitle: t('Threshold') },
      },
      {
        accessorKey: 'decision',
        header: t('Decision'),
        cell: ({ row }) =>
          row.original.decision === 1 ? (
            <Badge variant='destructive'>{t('Blocked')}</Badge>
          ) : (
            <Badge variant='secondary'>{t('Allowed (active session)')}</Badge>
          ),
        meta: { mobileTitle: t('Decision') },
      },
    ],
    [t]
  )

  const { table } = useDataTable({
    data: items,
    columns,
    pagination,
    onPaginationChange,
    manualPagination: true,
    totalCount: data?.total || 0,
  })

  const stats = statsQuery.data
  const decisionCount = (d: number) =>
    stats?.today.find((x) => x.decision === d)?.count ?? 0

  const setFilter = (patch: Record<string, unknown>) => {
    navigate({
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        ...patch,
        page: 1,
      }),
    })
  }

  const toolbar = (
    <div className='flex flex-col gap-3'>
      <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
        <div className='rounded-lg border p-3'>
          <div className='text-muted-foreground text-xs'>
            {t('Blocked today')}
          </div>
          <div className='text-2xl font-semibold'>{decisionCount(1)}</div>
        </div>
        <div className='rounded-lg border p-3'>
          <div className='text-muted-foreground text-xs'>
            {t('Allowed over limit today (active session)')}
          </div>
          <div className='text-2xl font-semibold'>{decisionCount(2)}</div>
        </div>
        <div className='rounded-lg border p-3'>
          <div className='text-muted-foreground text-xs'>
            {t('Peak estimated tokens (7d)')}
          </div>
          <div className='text-2xl font-semibold'>
            {stats?.max_estimated_tokens?.toLocaleString() ?? '-'}
          </div>
        </div>
        <div className='rounded-lg border p-3'>
          <div className='text-muted-foreground text-xs'>
            {t('Peak body size (7d)')}
          </div>
          <div className='text-2xl font-semibold'>
            {stats ? formatBytes(stats.max_body_bytes) : '-'}
          </div>
        </div>
      </div>

      {stats && stats.top_users.length > 0 && (
        <div className='flex flex-wrap items-center gap-2 text-sm'>
          <span className='text-muted-foreground'>{t('Top users (7d)')}:</span>
          {stats.top_users.map((u) => (
            <Badge key={u.user_id} variant='secondary'>
              {u.username} × {u.count}
            </Badge>
          ))}
        </div>
      )}

      <div className='flex flex-wrap items-center gap-2'>
        <Button
          size='sm'
          variant={decision === 0 ? 'default' : 'outline'}
          onClick={() => setFilter({ decision: undefined })}
        >
          {t('All')}
        </Button>
        <Button
          size='sm'
          variant={decision === 1 ? 'default' : 'outline'}
          onClick={() => setFilter({ decision: 1 })}
        >
          {t('Blocked')}
        </Button>
        <Button
          size='sm'
          variant={decision === 2 ? 'default' : 'outline'}
          onClick={() => setFilter({ decision: 2 })}
        >
          {t('Allowed (active session)')}
        </Button>
        <Input
          className='h-8 w-40'
          placeholder={t('Username')}
          defaultValue={username}
          onBlur={(e) => setFilter({ username: e.target.value || undefined })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setFilter({
                username: (e.target as HTMLInputElement).value || undefined,
              })
            }
          }}
        />
      </div>
    </div>
  )

  return (
    <SectionPageLayout fixedContent>
      <SectionPageLayout.Title>{t('Guard Logs')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <DataTablePage
          table={table}
          columns={columns}
          isLoading={isLoading}
          isFetching={isFetching}
          emptyTitle={t('No Guard Hits')}
          emptyDescription={t(
            'No blocked or over-limit requests recorded yet. Hit records appear here once the context length guard intercepts or allows oversized requests.'
          )}
          skeletonKeyPrefix='guard-logs-skeleton'
          toolbar={toolbar}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
