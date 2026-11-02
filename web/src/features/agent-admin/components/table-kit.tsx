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
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

export function TableShell({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <div className='overflow-x-auto rounded-lg border'>
      <table className='w-full text-sm'>
        <thead>
          <tr className='bg-muted/50 border-b text-left text-xs whitespace-nowrap'>{header}</tr>
        </thead>
        <tbody className='divide-y'>{children}</tbody>
      </table>
    </div>
  )
}

export function EmptyRow({ colSpan }: { colSpan: number }) {
  const { t } = useTranslation()
  return (
    <tr>
      <td colSpan={colSpan} className='text-muted-foreground py-8 text-center text-xs'>
        {t('No data')}
      </td>
    </tr>
  )
}

export function Pager({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}) {
  const { t } = useTranslation()
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
  return (
    <div className='flex items-center justify-end gap-2'>
      <span className='text-muted-foreground text-xs tabular-nums'>
        {page} / {totalPages} · {t('{{count}} total', { count: total })}
      </span>
      <Button
        variant='outline'
        size='icon'
        className='size-7'
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className='size-3.5' />
      </Button>
      <Button
        variant='outline'
        size='icon'
        className='size-7'
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className='size-3.5' />
      </Button>
    </div>
  )
}
