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
import { Search, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onClear: () => void
  placeholder?: string
  className?: string
}

export function SearchBar(props: SearchBarProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        inputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className={cn('group relative', props.className)}>
      {/* 聚焦光晕 */}
      <div
        aria-hidden
        className='from-primary/25 to-chart-2/20 pointer-events-none absolute -inset-0.5 rounded-xl bg-gradient-to-r opacity-0 blur-md transition-opacity duration-300 group-focus-within:opacity-100'
      />
      <div className='border-border/60 bg-background/90 group-focus-within:border-primary/60 relative flex h-12 items-center rounded-xl border shadow-sm backdrop-blur-sm transition-colors'>
        <span
          aria-hidden
          className='bg-primary/10 text-primary ml-2 flex h-8 items-center rounded-lg px-2 font-mono text-sm font-bold'
        >
          &gt;_
        </span>
        <Search className='text-muted-foreground/50 pointer-events-none ml-2.5 size-4 shrink-0' />
        <input
          ref={inputRef}
          type='text'
          placeholder={props.placeholder || t('Search models...')}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className={cn(
            'placeholder:text-muted-foreground/50 h-full min-w-0 flex-1 bg-transparent pr-3 pl-2.5 text-sm outline-none'
          )}
          aria-label={t('Search models')}
        />
        <div className='mr-2.5 flex shrink-0 items-center gap-1'>
          {props.value ? (
            <Button
              variant='ghost'
              size='icon'
              onClick={props.onClear}
              className='text-muted-foreground/60 hover:text-foreground size-7'
              aria-label={t('Clear search')}
            >
              <X className='size-4' />
            </Button>
          ) : (
            <kbd className='bg-muted text-muted-foreground pointer-events-none hidden rounded border px-1.5 py-0.5 font-mono text-[10px] sm:inline-block'>
              ⌘K
            </kbd>
          )}
        </div>
      </div>
    </div>
  )
}
