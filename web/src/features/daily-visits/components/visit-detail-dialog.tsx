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
import { ChevronLeft, ChevronRight, Globe, Timer } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { formatTimestamp } from '@/lib/format'
import {
  createServerError,
  requireServerSuccess,
} from '@/lib/server-error-message'

import { getVisitDetail } from '../api'
import type { VisitDetailTarget } from '../types'

const DETAIL_PAGE_SIZE = 20

interface VisitDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  startDate: string
  endDate: string
  target: VisitDetailTarget | null
}

export function VisitDetailDialog({
  open,
  onOpenChange,
  startDate,
  endDate,
  target,
}: VisitDetailDialogProps) {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)

  const isAnonymous = target ? target.userId <= 0 : false
  const rangeKey =
    startDate === endDate ? startDate : `${startDate} ~ ${endDate}`

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'visit-detail',
      startDate,
      endDate,
      target?.userId,
      target?.ip,
      page,
    ],
    enabled: open && !!target,
    queryFn: async () => {
      if (!target) {
        throw createServerError({}, t('Failed to load visit details'))
      }
      const result = await getVisitDetail({
        start_date: startDate,
        end_date: endDate,
        user_id: target.userId > 0 ? target.userId : undefined,
        ip: target.userId > 0 ? undefined : target.ip,
        p: page,
        page_size: DETAIL_PAGE_SIZE,
      })
      if (!result.success) {
        throw createServerError(result, t('Failed to load visit details'))
      }
      return requireServerSuccess(result).data
    },
    placeholderData: (previousData) => previousData,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / DETAIL_PAGE_SIZE))

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPage(1)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleClose}
      title={t('Visit Details')}
      description={
        target ? `${target.label} · ${t('Date')}: ${rangeKey}` : undefined
      }
      contentClassName='flex max-h-(--dialog-available-height) flex-col sm:max-w-xl'
      contentHeight='auto'
    >
      <div className='flex min-h-0 flex-1 flex-col gap-2'>
        {isLoading && (
          <div className='text-muted-foreground py-8 text-center text-sm'>
            {t('Loading...')}
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <div className='text-muted-foreground py-8 text-center text-sm'>
            {t('No visit records')}
          </div>
        )}
        {!isLoading && items.length > 0 && (
          <ul className='min-h-0 flex-1 divide-y overflow-y-auto'>
            {items.map((item) => (
              <li key={item.id} className='flex items-start gap-3 py-2 text-sm'>
                <span className='text-muted-foreground flex shrink-0 items-center gap-1'>
                  <Timer className='h-3.5 w-3.5' />
                  {formatTimestamp(item.created_at)}
                </span>
                <span className='min-w-0 flex-1 break-all'>{item.path}</span>
              </li>
            ))}
          </ul>
        )}

        <div className='flex items-center justify-between border-t pt-3'>
          <span className='text-muted-foreground text-xs'>
            {isAnonymous ? (
              <span className='inline-flex items-center gap-1'>
                <Globe className='h-3.5 w-3.5' />
                {target?.label}
              </span>
            ) : (
              target?.label
            )}
          </span>
          <div className='flex items-center gap-1'>
            <span className='text-muted-foreground me-2 text-xs'>
              {page} / {totalPages}
            </span>
            <Button
              variant='outline'
              size='icon-sm'
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <Button
              variant='outline'
              size='icon-sm'
              disabled={page >= totalPages || isFetching}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
