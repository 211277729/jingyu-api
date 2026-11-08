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
import { Globe, User as UserIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { BadgeCell, DataTablePage, useDataTable } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import dayjs from '@/lib/dayjs'
import { formatTimestamp, formatTimestampToDate } from '@/lib/format'
import {
  createServerError,
  requireServerSuccess,
} from '@/lib/server-error-message'

import { getDailyVisits } from '../api'
import type { VisitDetailTarget, VisitSummaryItem } from '../types'
import { VisitDateRangePicker } from './visit-date-range-picker'
import { VisitDetailDialog } from './visit-detail-dialog'

const route = getRouteApi('/_authenticated/daily-visits/')

export function DailyVisitsTable() {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [detailTarget, setDetailTarget] = useState<VisitDetailTarget | null>(
    null
  )
  const [detailOpen, setDetailOpen] = useState(false)

  const { start_date, end_date } = route.useSearch()
  const today = dayjs().format('YYYY-MM-DD')
  const rangeStart = start_date || today
  const rangeEnd = end_date || today

  const { pagination, onPaginationChange } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
  })
  const navigate = route.useNavigate()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'daily-visits',
      rangeStart,
      rangeEnd,
      pagination.pageIndex + 1,
      pagination.pageSize,
    ],
    queryFn: async () => {
      const result = await getDailyVisits({
        start_date: rangeStart,
        end_date: rangeEnd,
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      })
      if (!result.success) {
        throw createServerError(result, t('Failed to load daily visits'))
      }
      return requireServerSuccess(result).data
    },
    placeholderData: (previousData) => previousData,
  })

  const items = data?.items ?? []
  const stats = data?.stats

  const handleSelectRange = (nextStart: string, nextEnd: string) => {
    navigate({
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        start_date: nextStart,
        end_date: nextEnd,
        page: 1,
      }),
    })
  }

  const openDetail = (item: VisitSummaryItem) => {
    setDetailTarget({
      userId: item.user_id,
      ip: item.ip,
      label: item.is_anonymous ? item.ip : item.username || `#${item.user_id}`,
    })
    setDetailOpen(true)
  }

  const columns = useMemo<ColumnDef<VisitSummaryItem>[]>(
    () => [
      {
        accessorKey: 'username',
        header: t('Visitor'),
        cell: ({ row }) => {
          const item = row.original
          return (
            <BadgeCell>
              <span className='flex items-center gap-1.5'>
                {item.is_anonymous ? (
                  <Globe className='text-muted-foreground h-4 w-4 shrink-0' />
                ) : (
                  <UserIcon className='text-muted-foreground h-4 w-4 shrink-0' />
                )}
                <span className='max-w-48 truncate'>
                  {item.is_anonymous
                    ? item.ip
                    : item.username || `#${item.user_id}`}
                </span>
              </span>
              <Badge variant={item.is_anonymous ? 'outline' : 'secondary'}>
                {item.is_anonymous ? t('Anonymous') : t('User')}
              </Badge>
              {item.is_new_user && <Badge variant='default'>{t('New')}</Badge>}
            </BadgeCell>
          )
        },
        meta: { mobileTitle: t('Visitor') },
      },
      {
        accessorKey: 'visit_count',
        header: t('Visits'),
        cell: ({ row }) => row.original.visit_count,
      },
      {
        accessorKey: 'first_visit_at',
        header: t('First Visit'),
        cell: ({ row }) => formatTimestamp(row.original.first_visit_at),
      },
      {
        accessorKey: 'last_visit_at',
        header: t('Last Visit'),
        cell: ({ row }) => formatTimestamp(row.original.last_visit_at),
      },
      {
        accessorKey: 'user_created_at',
        header: t('Registered At'),
        cell: ({ row }) =>
          row.original.user_created_at
            ? formatTimestampToDate(row.original.user_created_at)
            : '-',
      },
      {
        id: 'actions',
        header: t('Actions'),
        cell: ({ row }) => (
          <Button
            variant='ghost'
            size='sm'
            onClick={() => openDetail(row.original)}
          >
            {t('Details')}
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const statsNode = stats ? (
    <div className='flex flex-wrap items-center gap-2'>
      <Badge variant='secondary'>
        {t('Total Visitors')}: {stats.total_visitors}
      </Badge>
      <Badge variant='secondary'>
        {t('Logged In')}: {stats.logged_in}
      </Badge>
      <Badge variant='secondary'>
        {t('Anonymous Visitors')}: {stats.anonymous}
      </Badge>
      <Badge variant='default'>
        {t('New Users')}: {stats.new_users}
      </Badge>
    </div>
  ) : null

  return (
    <>
      <DataTablePage
        table={table}
        columns={columns}
        isLoading={isLoading}
        isFetching={isFetching}
        emptyTitle={t('No Visits Found')}
        emptyDescription={t(
          'No visit records in this date range. Visitors are recorded when they browse the site.'
        )}
        skeletonKeyPrefix='daily-visits-skeleton'
        toolbar={
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <VisitDateRangePicker
              startDate={rangeStart}
              endDate={rangeEnd}
              onSelect={handleSelectRange}
            />
            {statsNode}
          </div>
        }
      />
      <VisitDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        startDate={rangeStart}
        endDate={rangeEnd}
        target={detailTarget}
      />
    </>
  )
}
