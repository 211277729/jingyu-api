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
import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

interface VisitDateRangePickerProps {
  startDate: string
  endDate: string
  onSelect: (startDate: string, endDate: string) => void
  disabled?: boolean
  className?: string
}

// 与使用日志的 CompactDateTimeRangePicker 同一套交互：
// 预设按钮 + 日期输入（草稿态）+ 确认；预设按钮直接生效。粒度为整天。
export function VisitDateRangePicker({
  startDate,
  endDate,
  onSelect,
  disabled,
  className,
}: VisitDateRangePickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draftStart, setDraftStart] = useState(startDate)
  const [draftEnd, setDraftEnd] = useState(endDate)

  const today = dayjs().format('YYYY-MM-DD')
  const label = startDate === endDate ? startDate : `${startDate} ~ ${endDate}`

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraftStart(startDate)
      setDraftEnd(endDate)
    }
    setOpen(nextOpen)
  }

  const normalize = (start: string, end: string) =>
    start <= end ? { start, end } : { start: end, end: start }

  const applyDraft = () => {
    const range = normalize(draftStart || today, draftEnd || today)
    onSelect(range.start, range.end)
    setOpen(false)
  }

  const applyPreset = (kind: 'today' | '7d' | 'week' | '30d' | 'month') => {
    const now = dayjs()
    const presets = {
      today: { start: today, end: today },
      '7d': {
        start: now.subtract(6, 'day').format('YYYY-MM-DD'),
        end: today,
      },
      week: {
        start: now.startOf('week').format('YYYY-MM-DD'),
        end: today,
      },
      '30d': {
        start: now.subtract(29, 'day').format('YYYY-MM-DD'),
        end: today,
      },
      month: {
        start: now.startOf('month').format('YYYY-MM-DD'),
        end: today,
      },
    }
    const { start, end } = presets[kind]
    setDraftStart(start)
    setDraftEnd(end)
    onSelect(start, end)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            disabled={disabled}
            aria-label={label}
            className={cn(
              'justify-start gap-2 px-2.5 text-sm leading-5 font-normal tabular-nums',
              className
            )}
          />
        }
      >
        <CalendarDays className='text-muted-foreground size-4 shrink-0' />
        <span className='truncate'>{label}</span>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='w-[min(360px,calc(100vw-2rem))] p-3'
      >
        <div className='space-y-3'>
          <div className='grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-end'>
            <div className='space-y-1.5'>
              <div className='text-muted-foreground text-xs'>
                {t('Start Time')}
              </div>
              <Input
                type='date'
                max={today}
                value={draftStart}
                aria-label={t('Start Time')}
                onChange={(e) => setDraftStart(e.target.value)}
                className='h-8 text-sm leading-5 tabular-nums'
              />
            </div>
            <span className='text-muted-foreground hidden pb-2 text-xs sm:block'>
              ~
            </span>
            <div className='space-y-1.5'>
              <div className='text-muted-foreground text-xs'>
                {t('End Time')}
              </div>
              <Input
                type='date'
                min={draftStart}
                max={today}
                value={draftEnd}
                aria-label={t('End Time')}
                onChange={(e) => setDraftEnd(e.target.value)}
                className='h-8 text-sm leading-5 tabular-nums'
              />
            </div>
          </div>

          <div className='flex flex-wrap gap-1.5'>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              className='h-7 flex-1 px-2 text-xs'
              onClick={() => applyPreset('today')}
            >
              {t('Today')}
            </Button>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              className='h-7 flex-1 px-2 text-xs'
              onClick={() => applyPreset('7d')}
            >
              {t('7 Days')}
            </Button>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              className='h-7 flex-1 px-2 text-xs'
              onClick={() => applyPreset('week')}
            >
              {t('This week')}
            </Button>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              className='h-7 flex-1 px-2 text-xs'
              onClick={() => applyPreset('30d')}
            >
              {t('30 Days')}
            </Button>
            <Button
              type='button'
              variant='secondary'
              size='sm'
              className='h-7 flex-1 px-2 text-xs'
              onClick={() => applyPreset('month')}
            >
              {t('Current month')}
            </Button>
          </div>

          <div className='flex justify-end'>
            <Button size='sm' className='h-8' onClick={applyDraft}>
              {t('Confirm')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
