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
import { formatBillingCurrencyFromUSD } from '@/lib/currency'

import { QUOTA_TYPE_VALUES, TOKEN_UNIT_DIVISORS } from '../constants'
import type { PricingModel, TokenUnit, PriceType } from '../types'
import { getDynamicPricingSummary } from './dynamic-price'
import { getConfiguredGroupRatio, getDisplayGroupRatio } from './model-helpers'

// ----------------------------------------------------------------------------
// Price Calculation Utilities
// ----------------------------------------------------------------------------

/**
 * Strip trailing zeros from formatted price string while preserving currency symbols
 */
export function stripTrailingZeros(formatted: string): string {
  // Match currency symbol at start, number, and potential 'k' suffix
  const match = formatted.match(/^([^\d-]*)([-\d,]+\.?\d*)(k?)$/)
  if (!match) return formatted

  const [, symbol, number, suffix] = match

  // Remove commas for processing
  const cleanNumber = number.replaceAll(',', '')

  // Convert to number and back to remove trailing zeros
  const parsed = Number.parseFloat(cleanNumber)
  if (Number.isNaN(parsed)) return formatted

  // Convert to string, which automatically removes trailing zeros
  let result = parsed.toString()

  // If the result is in scientific notation, format it properly
  if (result.includes('e')) {
    result = parsed.toFixed(20).replace(/\.?0+$/, '')
  }

  return `${symbol}${result}${suffix}`
}

/**
 * Calculate token price in USD.
 *
 * Returns NaN when the required ratio field is missing/null so callers can
 * skip rendering that price type.
 */
export function calculateTokenPrice(
  model: PricingModel,
  type: PriceType,
  ratio: number
): number {
  const base = model.model_ratio * 2 * ratio

  switch (type) {
    case 'input':
      return base
    case 'output':
      return base * model.completion_ratio
    case 'cache':
      return hasRatio(model.cache_ratio)
        ? base * Number(model.cache_ratio)
        : Number.NaN
    case 'create_cache':
      return hasRatio(model.create_cache_ratio)
        ? base * Number(model.create_cache_ratio)
        : Number.NaN
    case 'image':
      return hasRatio(model.image_ratio)
        ? base * Number(model.image_ratio)
        : Number.NaN
    case 'audio_input':
      return hasRatio(model.audio_ratio)
        ? base * Number(model.audio_ratio)
        : Number.NaN
    case 'audio_output':
      return hasRatio(model.audio_ratio) &&
        hasRatio(model.audio_completion_ratio)
        ? base *
            Number(model.audio_ratio) *
            Number(model.audio_completion_ratio)
        : Number.NaN
  }
}

function hasRatio(value: number | null | undefined): boolean {
  return value !== undefined && value !== null && Number.isFinite(Number(value))
}

/**
 * Apply recharge rate to price
 *
 * priceRate represents how much users need to recharge (in the display currency)
 * to get 1 USD credit. usdExchangeRate is the real exchange rate.
 *
 * The returned value will be formatted by formatBillingCurrencyFromUSD, which will
 * multiply by the display currency's exchange rate.
 *
 * Examples:
 *
 * 1. Display currency = USD:
 *    - Model: 1 USD
 *    - priceRate = 0.5 (recharge $0.5 to get $1 credit)
 *    - usdExchangeRate = 1
 *    - Return: 1 × 0.5 / 1 = 0.5
 *    - formatBillingCurrencyFromUSD(0.5) → $0.5 ✓
 *
 * 2. Display currency = CNY:
 *    - Model: 1 USD
 *    - priceRate = 4 (recharge ¥4 to get $1 credit)
 *    - usdExchangeRate = 7 (real rate: 1 USD = ¥7)
 *    - Return: 1 × 4 / 7 = 0.571
 *    - formatBillingCurrencyFromUSD(0.571) → 0.571 × 7 = ¥4 ✓
 *    - Normal price: ¥7, Recharge price: ¥4 (cheaper!)
 */
function applyRechargeRate(
  price: number,
  showWithRecharge: boolean,
  priceRate: number,
  usdExchangeRate: number
): number {
  if (!showWithRecharge) return price
  return (price * priceRate) / usdExchangeRate
}

/**
 * Format token-based price for display
 */
export function formatPrice(
  model: PricingModel,
  type: PriceType,
  tokenUnit: TokenUnit,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  selectedGroup?: string,
  showCurrencySymbol = true
): string {
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const displayGroupRatio = getDisplayGroupRatio(model, selectedGroup)

  let priceInUSD = calculateTokenPrice(model, type, displayGroupRatio)
  priceInUSD = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )

  const price = priceInUSD / TOKEN_UNIT_DIVISORS[tokenUnit]
  return formatBillingCurrencyFromUSD(price, {
    showSymbol: showCurrencySymbol,
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

/**
 * Fallback official-price USD exchange rate, matching the backend default
 * (ratio_setting.DefaultOfficialPriceExchangeRate). Used only when the pricing
 * payload predates the exchange_rate field.
 */
const DEFAULT_OFFICIAL_PRICE_EXCHANGE_RATE = 7.3

/**
 * Official prices come from real-USD sources (models.dev), while site prices
 * are quota-denominated (the site may recharge 1 CNY = 1 USD credit). Convert
 * official USD with the REAL exchange rate so both sides are comparable in the
 * display currency.
 */
export function getOfficialExchangeRate(model: PricingModel): number {
  const rate = model.official_price?.exchange_rate
  return rate && Number.isFinite(rate) && rate > 0
    ? rate
    : DEFAULT_OFFICIAL_PRICE_EXCHANGE_RATE
}

/** Which official-price tier applies to a time-tiered model. */
export type OfficialPriceTier = 'peak' | 'off_peak' | null

/**
 * Resolve the official-price tier for the current billing period.
 *
 * Time-tiered models bill through an expression that branches on hour()/
 * weekday() (e.g. DeepSeek peak vs off-peak). When peak official prices are
 * configured, the display must match the tier the user is actually billed in
 * right now — comparing a peak site price against an off-peak official price
 * would halve the discount badge.
 *
 * The current tier is detected from the dynamic summary's resolved input
 * price: it equals the most expensive branch's input price only inside the
 * peak branch (off-peak is cheaper by definition of peak pricing).
 */
export function getOfficialTimeTier(
  model: PricingModel,
  now?: Date
): OfficialPriceTier {
  const official = model.official_price
  if (!official?.peak_model_ratio || official.peak_model_ratio <= 0) {
    return null
  }
  const summary = getDynamicPricingSummary(model, {
    tokenUnit: 'M',
    ...(now ? { now } : {}),
  })
  const inputEntry = summary?.primaryEntries.find(
    (entry) => entry.field === 'inputPrice' && entry.unit === 'token'
  )
  if (!inputEntry) return null
  // billedInputUsdPerMillion is undefined → the ratio path; dynamic models
  // pass entry.value (base USD/1M, no group ratio), which is what we compare.
  const billed = inputEntry.value
  const tiers = summary?.tiers ?? []
  const branchInputs = tiers
    .filter((tier) => !('unitPrices' in tier) || tier.billingUnit !== 'request')
    .map((tier) => Number((tier as { inputPrice?: number }).inputPrice))
    .filter((value) => Number.isFinite(value) && value > 0)
  if (branchInputs.length < 2) return null
  const maxInput = Math.max(...branchInputs)
  return billed >= maxInput ? 'peak' : 'off_peak'
}

/**
 * Calculate official (list) token price for comparison display.
 *
 * Reference price only: no group ratio, no recharge discount. The raw USD
 * price is converted to the display currency with the official exchange rate,
 * then formatted like any billed price.
 * `now` selects the peak/off-peak tier for time-tiered models (when peak
 * prices are configured); otherwise the base tier applies.
 * Returns NaN when official price data is missing for the given type.
 */
export function calculateOfficialTokenPrice(
  model: PricingModel,
  type: PriceType,
  now?: Date
): number {
  const official = model.official_price
  if (!official || model.quota_type !== QUOTA_TYPE_VALUES.TOKEN) {
    return Number.NaN
  }

  const usePeak = getOfficialTimeTier(model, now) === 'peak'
  const modelRatio =
    usePeak && official.peak_model_ratio
      ? official.peak_model_ratio
      : official.model_ratio
  const completionRatio =
    usePeak && official.peak_completion_ratio
      ? official.peak_completion_ratio
      : official.completion_ratio
  const cacheRatio =
    usePeak && official.peak_cache_ratio != null
      ? official.peak_cache_ratio
      : official.cache_ratio

  const base = modelRatio * 2 * getOfficialExchangeRate(model)

  switch (type) {
    case 'input':
      return base
    case 'output':
      return completionRatio * base
    case 'cache':
      return hasRatio(cacheRatio) ? base * Number(cacheRatio) : Number.NaN
    case 'create_cache':
      return hasRatio(official.create_cache_ratio)
        ? base * Number(official.create_cache_ratio)
        : Number.NaN
    default:
      // audio/image official prices are not maintained
      return Number.NaN
  }
}

/**
 * Format official (list) token price for display.
 * Uses the same currency formatting as billed prices, symbol included.
 */
export function formatOfficialPrice(
  model: PricingModel,
  type: PriceType,
  tokenUnit: TokenUnit,
  now?: Date
): string {
  const priceInUSD = calculateOfficialTokenPrice(model, type, now)
  if (!Number.isFinite(priceInUSD)) return ''

  const price = priceInUSD / TOKEN_UNIT_DIVISORS[tokenUnit]
  return formatBillingCurrencyFromUSD(price, {
    showSymbol: true,
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

/**
 * Map a dynamic (billing-expression) entry field to the equivalent official
 * price type. Dynamic models bill via expressions, but their token-unit
 * entries carry the same semantic input/output/cache prices.
 */
export function officialPriceTypeForDynamicField(
  field: string
): PriceType | null {
  switch (field) {
    case 'inputPrice':
      return 'input'
    case 'outputPrice':
      return 'output'
    case 'cacheReadPrice':
      return 'cache'
    case 'cacheCreatePrice':
      return 'create_cache'
    default:
      return null
  }
}

/**
 * Discount ratio of the billed input price vs the official price,
 * e.g. 0.3 means "3折 / 70% off". Returns NaN when not computable.
 *
 * `billedInputUsdPerMillion` lets dynamic (expression-billed) models supply
 * their expression-derived input price; ratio-billed models fall back to
 * model_ratio. The billed side is quota-denominated USD/1M without group or
 * recharge effects; the official side is converted to the same display
 * currency with the official (real) USD exchange rate.
 * `now` selects the peak/off-peak official tier for time-tiered models so the
 * discount compares the same billing period on both sides.
 */
export function calculateOfficialDiscount(
  model: PricingModel,
  billedInputUsdPerMillion?: number,
  now?: Date
): number {
  if (
    !model.official_price ||
    model.quota_type !== QUOTA_TYPE_VALUES.TOKEN ||
    !Number.isFinite(model.official_price.model_ratio) ||
    model.official_price.model_ratio <= 0
  ) {
    return Number.NaN
  }

  let billed: number
  if (billedInputUsdPerMillion !== undefined) {
    billed = billedInputUsdPerMillion
  } else {
    if (!Number.isFinite(model.model_ratio)) return Number.NaN
    billed = model.model_ratio * 2
  }
  if (!Number.isFinite(billed) || billed <= 0) return Number.NaN

  const usePeak = getOfficialTimeTier(model, now) === 'peak'
  const officialModelRatio =
    usePeak && model.official_price.peak_model_ratio
      ? model.official_price.peak_model_ratio
      : model.official_price.model_ratio
  const officialBase = officialModelRatio * 2 * getOfficialExchangeRate(model)
  return billed / officialBase
}

/**
 * Format price for a specific group (token-based)
 */
export function formatGroupPrice(
  model: PricingModel,
  group: string,
  type: PriceType,
  tokenUnit: TokenUnit,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  groupRatio: Record<string, number>
): string {
  if (model.quota_type === QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const ratio = getConfiguredGroupRatio(groupRatio, group)
  let priceInUSD = calculateTokenPrice(model, type, ratio)

  priceInUSD = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )

  const price = priceInUSD / TOKEN_UNIT_DIVISORS[tokenUnit]
  return formatBillingCurrencyFromUSD(price, {
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

/**
 * Format fixed price for pay-per-request models (with specific group)
 */
export function formatFixedPrice(
  model: PricingModel,
  group: string,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  groupRatio: Record<string, number>
): string {
  if (model.quota_type !== QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const ratio = getConfiguredGroupRatio(groupRatio, group)
  let priceInUSD = (model.model_price || 0) * ratio

  priceInUSD = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )

  return formatBillingCurrencyFromUSD(priceInUSD, {
    digitsLarge: 4,
    digitsSmall: 4,
    abbreviate: false,
  })
}

/**
 * Format fixed price for pay-per-request models (minimum price from all groups)
 */
export function formatRequestPrice(
  model: PricingModel,
  showWithRecharge = false,
  priceRate = 1,
  usdExchangeRate = 1,
  selectedGroup?: string,
  showCurrencySymbol = true
): string {
  if (model.quota_type !== QUOTA_TYPE_VALUES.REQUEST) {
    return '-'
  }

  const displayGroupRatio = getDisplayGroupRatio(model, selectedGroup)

  let priceInUSD = (model.model_price || 0) * displayGroupRatio

  priceInUSD = applyRechargeRate(
    priceInUSD,
    showWithRecharge,
    priceRate,
    usdExchangeRate
  )

  return formatBillingCurrencyFromUSD(priceInUSD, {
    showSymbol: showCurrencySymbol,
    digitsLarge: 4,
    digitsSmall: 4,
    abbreviate: false,
  })
}
