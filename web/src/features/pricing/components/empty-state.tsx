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
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

export interface EmptyStateProps {
  searchQuery?: string
  hasActiveFilters: boolean
  onClearFilters: () => void
}

export function EmptyState(props: EmptyStateProps) {
  const { t } = useTranslation()
  const hasSearch = Boolean(props.searchQuery?.trim())

  return (
    <div className='border-border/60 bg-card/40 relative flex min-h-[320px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed px-6 py-12 text-center'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 opacity-40'
        style={{
          backgroundImage:
            'linear-gradient(to right, color-mix(in oklch, var(--foreground) 6%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 6%, transparent) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage:
            'radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 70% at 50% 50%, black 20%, transparent 100%)',
        }}
      />
      <div className='border-border/60 bg-background relative mb-3 flex size-12 items-center justify-center rounded-xl border shadow-sm'>
        <Search className='text-muted-foreground/50 size-5' />
      </div>

      <h3 className='text-foreground mb-1 text-base font-semibold'>
        {t('No models found')}
      </h3>

      <p className='text-muted-foreground mb-5 max-w-xs text-sm'>
        {hasSearch
          ? t(
              'No results for "{{query}}". Try adjusting your search or filters.',
              { query: props.searchQuery }
            )
          : t('No models match your current filters.')}
      </p>

      {(props.hasActiveFilters || hasSearch) && (
        <Button variant='outline' size='sm' onClick={props.onClearFilters}>
          {t('Clear all filters')}
        </Button>
      )}
    </div>
  )
}
