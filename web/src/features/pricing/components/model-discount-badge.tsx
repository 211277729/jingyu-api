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

import { StatusBadge } from '@/components/status-badge'
import { cn } from '@/lib/utils'

import {
  getDynamicDisplayGroupRatio,
  getDynamicPricingSummary,
} from '../lib/dynamic-price'
import { getDisplayGroupRatio } from '../lib/model-helpers'
import { calculateOfficialDiscount, getOfficialTimeTier } from '../lib/price'
import type { PricingModel } from '../types'

interface ModelDiscountBadgeProps {
  model: PricingModel
  /** Selected group, so the badge compares the same price the user sees. */
  selectedGroup?: string
  appearance?: 'default' | 'caption'
  className?: string
  /** Current billing time, so time-tiered models compare the same tier. */
  now?: Date
}

/**
 * Discount badge comparing the site's displayed input price (including the
 * display group ratio, matching the price cells) against the official
 * (list) price. Only shown for token-based models with valid official data
 * and a meaningful discount (1%-99%).
 *
 * Dynamic (expression-billed) models derive the billed input price from
 * their expression's base inputPrice entry; ratio-billed models use
 * model_ratio. Recharge-rate display mode is intentionally excluded so the
 * badge reflects the pricing itself, not the wallet discount.
 */
export function ModelDiscountBadge(props: ModelDiscountBadgeProps) {
  const { t, i18n } = useTranslation()

  const groupRatio = getDisplayGroupRatio(props.model, props.selectedGroup)

  let billedInput: number | undefined
  const dynamic = getDynamicPricingSummary(props.model, {
    tokenUnit: 'M',
    groupRatioMultiplier: groupRatio,
  })
  if (dynamic) {
    const inputEntry = dynamic.primaryEntries.find(
      (entry) => entry.field === 'inputPrice' && entry.unit === 'token'
    )
    // Task-usage / per-request dynamic models have no token input price
    if (!inputEntry) return null
    // entry.value is the base USD/1M price; the display group ratio is the
    // same multiplier the price cells apply on top of it.
    billedInput =
      inputEntry.value *
      getDynamicDisplayGroupRatio(props.model, props.selectedGroup)
  }

  const discount = calculateOfficialDiscount(
    props.model,
    billedInput,
    // 时段计费模型按当前时段对应的官方价档位(高峰/低峰)计算折扣
    props.now
  )
  if (!Number.isFinite(discount)) return null

  const tier = getOfficialTimeTier(props.model, props.now)
  const percent = discount * 100
  // Only render when the site price is genuinely cheaper than official
  if (percent <= 0 || percent >= 100) return null

  // zh: "3.5折" style; other languages: "65% off" style
  const isZh = i18n.language.toLowerCase().startsWith('zh')
  const label = isZh
    ? t('{{count}}折', { count: Number((percent / 10).toFixed(1)) })
    : t('{{percent}}% off', { percent: Math.round(100 - percent) })

  return (
    <StatusBadge
      label={label}
      variant='success'
      type={props.appearance === 'caption' ? 'text' : undefined}
      copyable={false}
      size='sm'
      className={cn(
        props.appearance === 'caption' && 'text-xs font-normal',
        props.className
      )}
    />
  )
}
