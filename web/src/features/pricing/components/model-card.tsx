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
import { ChevronRight } from 'lucide-react'
import { memo, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { DEFAULT_TOKEN_UNIT } from '../constants'
import { useBillingTime } from '../hooks/use-billing-time'
import {
  getCardExamplePrice,
  getDynamicDisplayGroupRatio,
  getDynamicPriceUnitLabelKey,
  getDynamicPricingSummary,
  isUnconfiguredTaskUsageModel,
} from '../lib/dynamic-price'
import { parseTags } from '../lib/filters'
import { isTokenBasedModel } from '../lib/model-helpers'
import {
  formatOfficialPrice,
  formatPrice,
  formatRequestPrice,
  getOfficialTimeTier,
  officialPriceTypeForDynamicField,
} from '../lib/price'
import { taskPriceLabel, taskUsageUnitLabel } from '../lib/task-price-display'
import type { PricingModel, PriceType, TokenUnit } from '../types'
import { ModelBillingModeBadge } from './model-billing-mode-badge'
import { ModelDiscountBadge } from './model-discount-badge'
import { ModelPerfBadge, type ModelPerfBadgeData } from './model-perf-badge'

export interface ModelCardProps {
  model: PricingModel
  onClick: (modelName: string) => void
  priceRate?: number
  usdExchangeRate?: number
  tokenUnit?: TokenUnit
  showRechargePrice?: boolean
  selectedGroup?: string
  perf?: ModelPerfBadgeData
}

export const ModelCard = memo(function ModelCard(props: ModelCardProps) {
  const { t, i18n } = useTranslation()
  const tokenUnit = props.tokenUnit ?? DEFAULT_TOKEN_UNIT
  const priceRate = props.priceRate ?? 1
  const usdExchangeRate = props.usdExchangeRate ?? 1
  const showRechargePrice = props.showRechargePrice ?? false
  const isTokenBased = isTokenBasedModel(props.model)
  const tokenUnitLabel = tokenUnit === 'K' ? '1K' : '1M'
  const tags = parseTags(props.model.tags)
  const groups = props.model.enable_groups || []
  const endpoints = props.model.supported_endpoint_types || []
  const modelIconKey = props.model.icon || props.model.vendor_icon
  const modelIcon = modelIconKey ? getLobeIcon(modelIconKey, 28) : null
  const initial = props.model.model_name?.charAt(0).toUpperCase() || '?'
  const isUnconfiguredTaskUsage = isUnconfiguredTaskUsageModel(props.model)
  const billingTime = useBillingTime(props.model.billing_expr)
  const currency = useSystemConfigStore((state) => state.config.currency)
  const dynamicPriceOptions = useMemo(
    () => ({
      now: billingTime === undefined ? undefined : new Date(billingTime),
      tokenUnit,
      showRechargePrice,
      priceRate,
      usdExchangeRate,
      groupRatioMultiplier: getDynamicDisplayGroupRatio(
        props.model,
        props.selectedGroup
      ),
    }),
    [
      props.model,
      props.selectedGroup,
      billingTime,
      tokenUnit,
      showRechargePrice,
      priceRate,
      usdExchangeRate,
    ]
  )
  const dynamicSummary = useMemo(
    () => getDynamicPricingSummary(props.model, dynamicPriceOptions),
    // Currency is read indirectly by the price formatter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.model, dynamicPriceOptions, currency]
  )
  const cardExamplePrice = useMemo(
    () => getCardExamplePrice(props.model, dynamicPriceOptions),
    // Currency is read indirectly by the price formatter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.model, dynamicPriceOptions, currency]
  )
  let priceSummary: ReactNode
  if (dynamicSummary) {
    const cacheReadEntries = dynamicSummary.secondaryEntries.filter(
      (entry) => entry.field === 'cacheReadPrice' && entry.unit === 'token'
    )
    if (dynamicSummary.isSpecialExpression) {
      priceSummary = (
        <div className='col-span-full min-w-0'>
          <span className='text-warning'>
            {t('Special billing expression')}
          </span>
          <code className='text-muted-foreground mt-1 line-clamp-2 block font-mono text-xs break-all'>
            {dynamicSummary.rawExpression}
          </code>
        </div>
      )
    } else if (
      dynamicSummary.primaryEntries.length > 0 ||
      cacheReadEntries.length > 0
    ) {
      // 时段计费模型:官方价按当前时段选档,标签带「高峰/低峰」
      const officialTierLabel = getOfficialTimeTier(
        props.model,
        billingTime === undefined ? undefined : new Date(billingTime)
      )
      const officialByField: Partial<Record<string, string>> = {}
      for (const entry of [
        ...dynamicSummary.primaryEntries,
        ...cacheReadEntries,
      ]) {
        const type = officialPriceTypeForDynamicField(entry.field)
        if (!type) continue
        const formatted = formatOfficialPrice(
          props.model,
          type,
          tokenUnit,
          billingTime === undefined ? undefined : new Date(billingTime)
        )
        if (formatted) officialByField[entry.field] = formatted
      }
      priceSummary = (
        <>
          {[
            dynamicSummary.primaryEntries.slice(
              0,
              dynamicSummary.providerCount ? 2 : undefined
            ),
            cacheReadEntries,
          ]
            .flat()
            .map((entry) => {
              const unitLabelKey = getDynamicPriceUnitLabelKey(entry)
              const unitLabel = taskUsageUnitLabel(
                entry,
                i18n.language,
                unitLabelKey ? t(unitLabelKey) : tokenUnitLabel
              )
              let label: ReactNode = null
              if (entry.labelKind !== 'schema') {
                label = t(entry.shortLabel)
              } else {
                label = taskPriceLabel(
                  entry.description,
                  entry.shortLabel,
                  i18n.language
                )
              }
              const officialValue = officialByField[entry.field]
              return (
                <div
                  key={entry.key}
                  className={cn(
                    'flex min-w-0 flex-col gap-2',
                    dynamicSummary.isTaskUsage && 'col-span-full'
                  )}
                >
                  {officialValue && (
                    <div className='flex min-w-0 flex-col gap-0.5'>
                      <span className='text-muted-foreground text-xs break-words whitespace-normal'>
                        {t('Official {{label}}', { label })}
                        {officialTierLabel && (
                          <>
                            {' '}
                            (
                            {t(
                              officialTierLabel === 'peak'
                                ? 'Peak period'
                                : 'Off-peak period'
                            )}
                            )
                          </>
                        )}
                      </span>
                      <span
                        className='text-muted-foreground font-mono text-xs tabular-nums line-through'
                        title={t('Official price')}
                      >
                        {officialValue} / {unitLabel}
                      </span>
                    </div>
                  )}
                  <div className='flex min-w-0 flex-col gap-0.5'>
                    {label && (
                      <span className='text-muted-foreground text-xs break-words whitespace-normal'>
                        {label}
                      </span>
                    )}
                    <span className='flex flex-wrap items-baseline gap-x-1 font-mono text-sm font-semibold tabular-nums'>
                      <span>{entry.formattedRange ?? entry.formatted}</span>
                      <span className='text-muted-foreground text-xs font-normal whitespace-nowrap'>
                        {' '}
                        / {unitLabel}
                      </span>
                    </span>
                  </div>
                </div>
              )
            })}
          {dynamicSummary.isTimePricing && (
            <span className='text-muted-foreground col-span-full text-xs'>
              {t('Current period price')}
            </span>
          )}
          {dynamicSummary.isMixedBilling && (
            <span className='text-muted-foreground col-span-full text-xs'>
              {t('Token or per-call pricing')}
            </span>
          )}
          {cardExamplePrice && (
            <span className='text-muted-foreground col-span-full text-xs break-words'>
              {cardExamplePrice.label} ≈ {cardExamplePrice.formatted}
            </span>
          )}
          {dynamicSummary.isTaskUsage &&
            dynamicSummary.tierCount > 1 &&
            dynamicSummary.tier?.label &&
            !dynamicSummary.primaryEntries.some(
              (entry) => entry.formattedRange
            ) && (
              <span className='text-muted-foreground col-span-full text-xs break-words'>
                ({dynamicSummary.tier.label})
              </span>
            )}
        </>
      )
    } else {
      priceSummary = (
        <span className='text-muted-foreground col-span-full'>
          {dynamicSummary.hasUnconfiguredProviders
            ? t('Usage-based billing · price not configured')
            : t('Dynamic Pricing')}
        </span>
      )
    }
  } else if (isUnconfiguredTaskUsage) {
    priceSummary = (
      <span className='text-muted-foreground col-span-full'>
        {t('Usage-based billing · price not configured')}
      </span>
    )
  } else if (isTokenBased) {
    // 时段计费模型:官方价按当前时段选档,标签带「高峰/低峰」
    const officialTierLabel = getOfficialTimeTier(
      props.model,
      billingTime === undefined ? undefined : new Date(billingTime)
    )
    const prices: { type: PriceType; label: string }[] = [
      { type: 'input', label: t('Input') },
      { type: 'output', label: t('Output') },
      ...(props.model.cache_ratio != null
        ? [{ type: 'cache' as const, label: t('Cached') }]
        : []),
    ]
    priceSummary = prices.map((price) => {
      const officialValue = formatOfficialPrice(
        props.model,
        price.type,
        tokenUnit,
        billingTime === undefined ? undefined : new Date(billingTime)
      )
      return (
        <div key={price.type} className='flex min-w-0 flex-col gap-2'>
          {officialValue && (
            <div className='flex min-w-0 flex-col gap-0.5'>
              <span className='text-muted-foreground text-xs break-words whitespace-normal'>
                {t('Official {{label}}', { label: price.label })}
                {officialTierLabel && (
                  <>
                    {' '}
                    (
                    {t(
                      officialTierLabel === 'peak'
                        ? 'Peak period'
                        : 'Off-peak period'
                    )}
                    )
                  </>
                )}
              </span>
              <span
                className='text-muted-foreground font-mono text-xs tabular-nums line-through'
                title={t('Official price')}
              >
                {officialValue} / {tokenUnitLabel}
              </span>
            </div>
          )}
          <div className='flex min-w-0 flex-col gap-0.5'>
            <span className='text-muted-foreground text-xs'>{price.label}</span>
            <span className='flex flex-wrap items-baseline gap-x-1'>
              <span className='font-mono text-sm font-semibold tabular-nums'>
                {formatPrice(
                  props.model,
                  price.type,
                  tokenUnit,
                  showRechargePrice,
                  priceRate,
                  usdExchangeRate,
                  props.selectedGroup
                )}
              </span>
              <span className='text-muted-foreground text-xs font-normal'>
                {' '}
                / {tokenUnitLabel}
              </span>
            </span>
          </div>
        </div>
      )
    })
  } else {
    priceSummary = (
      <div className='col-span-full flex min-w-0 flex-col gap-1'>
        <span className='font-mono text-sm font-semibold tabular-nums'>
          {formatRequestPrice(
            props.model,
            showRechargePrice,
            priceRate,
            usdExchangeRate,
            props.selectedGroup
          )}
          <span className='text-muted-foreground text-xs font-normal'>
            {' '}
            / {t('request')}
          </span>
        </span>
      </div>
    )
  }

  return (
    <Card className='group hover:border-primary/40 hover:shadow-primary/10 relative h-full min-w-0 gap-3 overflow-hidden shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl'>
      <div
        aria-hidden
        className='via-primary/80 pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100'
      />
      <CardHeader className='flex flex-row items-start gap-3'>
        <div
          aria-hidden
          className='from-primary/15 to-chart-2/15 ring-primary/20 flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ring-1'
        >
          {modelIcon || (
            <span className='text-primary/80 font-mono text-sm font-bold'>
              {initial}
            </span>
          )}
        </div>
        <div className='min-w-0 flex-1'>
          <h3
            className='line-clamp-2 font-mono text-[15px] leading-snug font-semibold [overflow-wrap:anywhere]'
            title={props.model.model_name}
          >
            {props.model.model_name}
          </h3>
          {props.model.vendor_name && (
            <p
              className='text-muted-foreground mt-1 truncate font-mono text-[11px] tracking-wide uppercase'
              title={props.model.vendor_name}
            >
              {props.model.vendor_name}
            </p>
          )}
        </div>
        <CopyButton
          value={props.model.model_name}
          tooltip={t('Copy model name')}
          className='size-7'
          iconClassName='size-3.5'
        />
      </CardHeader>
      <CardContent className='flex flex-1 flex-col gap-3'>
        <div className='flex min-w-0 flex-col gap-1.5'>
          <p className='text-muted-foreground line-clamp-2 text-[13px] leading-5 break-words'>
            {props.model.description || t('No description available.')}
          </p>
          {tags.length > 0 && (
            <div
              role='group'
              aria-label={t('Tags')}
              className='flex min-w-0 flex-wrap items-center gap-1'
            >
              {tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className='border-border/60 bg-muted/60 text-muted-foreground rounded-md border px-1.5 py-0.5 font-mono text-[11px]'
                  title={tag}
                >
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span
                  className='text-muted-foreground text-[11px]'
                  title={tags.slice(3).join(', ')}
                >
                  +{tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
        <div
          role='group'
          aria-label={t('Pricing')}
          className='border-border/50 mt-auto flex min-w-0 flex-col gap-1.5 border-t pt-3'
        >
          <div className='flex flex-wrap items-center gap-x-1.5 gap-y-1'>
            <ModelBillingModeBadge model={props.model} appearance='caption' />
            <ModelDiscountBadge
              model={props.model}
              selectedGroup={props.selectedGroup}
              now={billingTime === undefined ? undefined : new Date(billingTime)}
            />
          </div>
          {dynamicSummary?.providerCount && (
            <span className='text-muted-foreground text-xs break-words'>
              {t('{{count}} providers', {
                count: dynamicSummary.providerCount,
              })}
              {dynamicSummary.hasUnconfiguredProviders &&
                ` · ${t('Not configured for some providers')}`}
            </span>
          )}
          <div className='grid grid-cols-[repeat(auto-fit,minmax(88px,1fr))] gap-x-3 gap-y-2'>
            {priceSummary}
          </div>
        </div>
        {(groups.length > 0 || endpoints.length > 0) && (
          <dl
            className={cn(
              'grid min-w-0 grid-cols-2 gap-3 text-xs',
              (groups.length === 0 || endpoints.length === 0) && 'grid-cols-1'
            )}
          >
            {groups.length > 0 && (
              <div className='flex min-w-0 items-baseline gap-1.5'>
                <dt className='text-muted-foreground shrink-0 font-mono text-[11px] tracking-wide uppercase'>
                  {t('Groups')}
                </dt>
                <dd className='flex min-w-0 items-baseline gap-1'>
                  <span className='truncate' title={groups.join(', ')}>
                    {groups[0]}
                  </span>
                  {groups.length > 1 && (
                    <span
                      className='text-muted-foreground shrink-0'
                      title={groups.slice(1).join(', ')}
                    >
                      +{groups.length - 1}
                    </span>
                  )}
                </dd>
              </div>
            )}
            {endpoints.length > 0 && (
              <div className='flex min-w-0 items-baseline gap-1.5'>
                <dt className='text-muted-foreground shrink-0 font-mono text-[11px] tracking-wide uppercase'>
                  {t('Endpoints')}
                </dt>
                <dd className='flex min-w-0 items-baseline gap-1'>
                  <span className='truncate' title={endpoints.join(', ')}>
                    {endpoints.slice(0, 2).join(', ')}
                  </span>
                  {endpoints.length > 2 && (
                    <span
                      className='text-muted-foreground shrink-0'
                      title={endpoints.slice(2).join(', ')}
                    >
                      +{endpoints.length - 2}
                    </span>
                  )}
                </dd>
              </div>
            )}
          </dl>
        )}
      </CardContent>
      <CardFooter className='mt-auto border-0 bg-transparent pt-0'>
        <ModelPerfBadge
          perf={props.perf}
          className='border-border/60 border-t pt-2'
        >
          <Button
            variant='ghost'
            size='sm'
            onClick={() => props.onClick(props.model.model_name || '')}
            className='-mr-2 text-xs'
          >
            {t('Details')}
            <ChevronRight
              aria-hidden
              className='size-3.5 transition-transform duration-200 group-hover:translate-x-0.5'
            />
          </Button>
        </ModelPerfBadge>
      </CardFooter>
    </Card>
  )
})
