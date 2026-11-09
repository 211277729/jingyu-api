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
import { Link, useNavigate } from '@tanstack/react-router'
import { Gift, Sparkles } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Button } from '@/components/ui/button'

import { EmptyState, ModelCardGrid, LoadingSkeleton } from './components'
import { usePricingData } from './hooks/use-pricing-data'
import { getDisplayGroupRatio } from './lib/model-helpers'
import type { PricingModel } from './types'

// 免费判定：落地页只收录能静态算出 0 元的模型。动态计费（billing_mode
// 表达式）无法离线求值，宁可漏收也不误标；按次模型看 model_price，
// token 模型看模型倍率或任一可用分组倍率是否为 0。
function isFreeModel(
  model: PricingModel,
  usableGroup: Record<string, { desc: string; ratio: number }>
): boolean {
  if (model.billing_mode) return false
  if (model.quota_type === 1) return (model.model_price ?? 0) === 0
  if (!usableGroup || Object.keys(usableGroup).length === 0) return false
  if ((model.model_ratio ?? 0) === 0) return true
  return getDisplayGroupRatio(model) === 0
}

export function FreeModels() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { models, usableGroup, isLoading, priceRate, usdExchangeRate } =
    usePricingData()

  const freeModels = useMemo(() => {
    const group = usableGroup || {}
    return (models || []).filter((model) => isFreeModel(model, group))
  }, [models, usableGroup])

  return (
    <PublicLayout showMainContainer={false}>
      <PageTransition className='mx-auto w-full max-w-[1800px] px-3 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10 xl:px-8'>
        <header className='mx-auto max-w-2xl text-center'>
          <div className='border-primary/30 bg-primary/5 text-primary mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium'>
            <Gift aria-hidden className='size-3.5' />
            {t('Free Models')}
          </div>
          <h1 className='text-foreground text-2xl font-bold tracking-tight sm:text-3xl'>
            {t('Free LLM API models, $0 to call')}
          </h1>
          <p className='text-muted-foreground mt-3 text-sm leading-relaxed sm:text-base'>
            {t(
              'These models cost nothing on Jingyu API: some are billed at $0 by the model itself, others are free through a zero-ratio group. Register and start calling — free models stay free long-term.'
            )}
          </p>
          {!isLoading && (
            <p className='text-muted-foreground/70 mt-3 font-mono text-[11px] tracking-[0.2em] uppercase'>
              {t('{{count}} free models available', {
                count: freeModels.length,
              })}
            </p>
          )}
        </header>

        <main className='mt-8 min-w-0 space-y-4'>
          {isLoading ? (
            <LoadingSkeleton viewMode='card' />
          ) : freeModels.length === 0 ? (
            <EmptyState
              hasActiveFilters={false}
              onClearFilters={() => undefined}
            />
          ) : (
            <>
              <ModelCardGrid
                models={freeModels}
                onModelClick={(modelName) => {
                  void navigate({
                    to: '/pricing/$modelId',
                    params: { modelId: modelName },
                  })
                }}
                priceRate={priceRate}
                usdExchangeRate={usdExchangeRate}
              />
              <div className='border-border/60 bg-background/60 mx-auto mt-10 flex max-w-2xl flex-col items-center gap-3 rounded-2xl border p-6 text-center sm:p-8'>
                <Sparkles aria-hidden className='text-primary/70 size-5' />
                <h2 className='text-foreground text-base font-semibold'>
                  {t('Ready to call these models for free?')}
                </h2>
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'Create a key, pick any free model above, and your first request costs nothing.'
                  )}
                </p>
                <div className='mt-1 flex flex-wrap items-center justify-center gap-3'>
                  <Button size='sm' render={<Link to='/sign-up' />}>
                    {t('Sign up')}
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    render={<Link to='/docs' />}
                  >
                    {t('Docs')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </main>
      </PageTransition>
    </PublicLayout>
  )
}
