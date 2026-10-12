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
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'

/** Wire-protocol ids a model can advertise, mapped to a short display label. */
const PROTOCOL_LABELS: Record<string, string> = {
  openai: 'Chat',
  'openai-response': 'Response',
  anthropic: 'Anthropic',
}

export function ModelList() {
  const { t } = useTranslation()
  const { models, isLoading } = usePricingData()

  if (isLoading) {
    return (
      <div className='space-y-2'>
        <Skeleton className='h-9 w-full' />
        <Skeleton className='h-9 w-full' />
      </div>
    )
  }

  if (models.length === 0) {
    return (
      <p className='text-muted-foreground text-sm'>
        {t('No models are currently available.')}
      </p>
    )
  }

  return (
    <div className='ring-foreground/10 divide-foreground/10 divide-y overflow-hidden rounded-xl ring-1'>
      {models.map((model) => (
        <div
          key={model.key}
          className='flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5'
        >
          <div className='flex min-w-0 items-center gap-1.5'>
            <code className='truncate font-mono text-sm'>
              {model.model_name}
            </code>
            <CopyButton
              value={model.model_name}
              className='size-6'
              iconClassName='size-3.5'
            />
          </div>
          <div className='flex flex-wrap items-center gap-1.5'>
            {(model.supported_endpoint_types ?? []).map((type) => (
              <Badge key={type} variant='outline'>
                {PROTOCOL_LABELS[type] ?? type}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
