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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DISABLED_ROW_DESKTOP,
  DISABLED_ROW_MOBILE,
  DataTablePage,
  useDataTable,
} from '@/components/data-table'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'

import { getResources } from '../api'
import { RESOURCE_ENABLED_OPTIONS, RESOURCE_KIND_OPTIONS } from '../constants'
import { useResourcesColumns } from './resources-columns'
import { useResourcesAdmin } from './resources-provider'

const route = getRouteApi('/_authenticated/resources-admin/')

export function ResourcesTable() {
  const { t } = useTranslation()
  const columns = useResourcesColumns()
  const { refreshTrigger } = useResourcesAdmin()
  const isMobile = useMediaQuery('(max-width: 640px)')

  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [
      { columnId: 'kind', searchKey: 'kind', type: 'array' },
      { columnId: 'enabled', searchKey: 'enabled', type: 'array' },
    ],
  })

  const kindFilter =
    (columnFilters.find((filter) => filter.id === 'kind')?.value as
      | string[]
      | undefined) ?? []
  const enabledFilter =
    (columnFilters.find((filter) => filter.id === 'enabled')?.value as
      | string[]
      | undefined) ?? []

  const kindValue = kindFilter[0] ?? ''
  const enabledValue = enabledFilter[0] ?? ''

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'resources-admin',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      kindValue,
      enabledValue,
      refreshTrigger,
    ],
    queryFn: () =>
      getResources({
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        keyword: globalFilter?.trim() || undefined,
        kind: kindValue || undefined,
        enabled: enabledValue || undefined,
      }),
    placeholderData: (previousData) => previousData,
  })

  const resources = data?.items ?? []

  const { table } = useDataTable({
    data: resources,
    columns,
    columnFilters,
    globalFilter,
    pagination,
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: true,
    manualFiltering: true,
    totalCount: data?.total ?? 0,
    ensurePageInRange,
  })

  const kindOptions = useMemo(
    () =>
      RESOURCE_KIND_OPTIONS.map((option) => ({
        label: t(option.labelKey),
        value: option.value,
      })),
    [t]
  )

  const enabledOptions = useMemo(
    () =>
      RESOURCE_ENABLED_OPTIONS.filter((option) => option.value !== 'all').map(
        (option) => ({
          label: t(option.labelKey),
          value: option.value,
        })
      ),
    [t]
  )

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No resources yet')}
      emptyDescription={t(
        'Create your first resource, or run the seed SQL to import the starter catalog.'
      )}
      skeletonKeyPrefix='resources-admin-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Filter by name, slug or tag...'),
        searchDebounceMs: 500,
        filters: [
          {
            columnId: 'kind',
            title: t('Category'),
            options: kindOptions,
            singleSelect: true,
          },
          {
            columnId: 'enabled',
            title: t('Published'),
            options: enabledOptions,
            singleSelect: true,
          },
        ],
      }}
      getRowClassName={(row, { isMobile }) => {
        if (row.original.enabled) return undefined
        return isMobile ? DISABLED_ROW_MOBILE : DISABLED_ROW_DESKTOP
      }}
    />
  )
}
