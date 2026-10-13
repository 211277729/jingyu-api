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
import { describe, expect, test } from 'vitest'

import { PAYMENT_TYPES } from '../constants'
import type { TopupInfo } from '../types'
import {
  dispatchSelectedPayment,
  getDefaultPaymentType,
  getDisplayPriceRatio,
  isPaymentGatewayEnabled,
  isStripePayment,
  isWaffoPayment,
  isWaffoPancakePayment,
} from './payment'

function buildTopupInfo(overrides: Partial<TopupInfo>): TopupInfo {
  return {
    enable_online_topup: false,
    enable_stripe_topup: false,
    pay_methods: [],
    min_topup: 1,
    stripe_min_topup: 1,
    amount_options: [],
    discount: {},
    ...overrides,
  }
}

describe('payment type classification', () => {
  test('keeps Waffo and Waffo Pancake on their dedicated flows', () => {
    expect(isWaffoPayment(PAYMENT_TYPES.WAFFO)).toBe(true)
    expect(isWaffoPayment(PAYMENT_TYPES.WAFFO_PANCAKE)).toBe(false)
    expect(isWaffoPancakePayment(PAYMENT_TYPES.WAFFO_PANCAKE)).toBe(true)
    expect(isWaffoPancakePayment(PAYMENT_TYPES.WAFFO)).toBe(false)
    expect(isStripePayment(PAYMENT_TYPES.STRIPE)).toBe(true)
  })
})

describe('gateway availability', () => {
  test('treats Epay method entries as unavailable while the Epay gateway is off', () => {
    const topupInfo = buildTopupInfo({
      pay_methods: [
        { name: '支付宝', type: PAYMENT_TYPES.ALIPAY },
        { name: '微信支付', type: PAYMENT_TYPES.WXPAY_OFFICIAL },
      ],
      enable_wxpay_topup: true,
    })

    expect(isPaymentGatewayEnabled(topupInfo, PAYMENT_TYPES.ALIPAY)).toBe(false)
    expect(
      isPaymentGatewayEnabled(topupInfo, PAYMENT_TYPES.WXPAY_OFFICIAL)
    ).toBe(true)
  })

  test('defaults to the configured gateway instead of an unconfigured Epay entry', () => {
    const topupInfo = buildTopupInfo({
      pay_methods: [
        { name: '支付宝', type: PAYMENT_TYPES.ALIPAY },
        { name: '微信支付', type: PAYMENT_TYPES.WXPAY_OFFICIAL },
      ],
      enable_wxpay_topup: true,
    })

    expect(getDefaultPaymentType(topupInfo)).toBe(PAYMENT_TYPES.WXPAY_OFFICIAL)
  })

  test('falls back to the first listed method when nothing is configured', () => {
    const topupInfo = buildTopupInfo({
      pay_methods: [{ name: '支付宝', type: PAYMENT_TYPES.ALIPAY }],
    })

    expect(getDefaultPaymentType(topupInfo)).toBe(PAYMENT_TYPES.ALIPAY)
  })
})

describe('display price ratio', () => {
  test('uses the WeChat Pay unit price instead of the shared Epay price', () => {
    const topupInfo = buildTopupInfo({
      enable_wxpay_topup: true,
      wxpay_unit_price: 1,
    })

    expect(
      getDisplayPriceRatio(topupInfo, PAYMENT_TYPES.WXPAY_OFFICIAL, 7.3)
    ).toBe(1)
  })

  test('keeps the shared price for Epay methods and missing unit price', () => {
    const withUnitPrice = buildTopupInfo({ wxpay_unit_price: 1 })

    expect(getDisplayPriceRatio(withUnitPrice, PAYMENT_TYPES.ALIPAY, 7.3)).toBe(
      7.3
    )
    expect(
      getDisplayPriceRatio(buildTopupInfo({}), PAYMENT_TYPES.WXPAY_OFFICIAL, 7.3)
    ).toBe(7.3)
  })
})

describe('payment dispatch', () => {
  test('keeps the selected Waffo method index through confirmation', async () => {
    const calls: string[] = []
    const success = await dispatchSelectedPayment(
      { name: 'Waffo Card', type: PAYMENT_TYPES.WAFFO },
      120,
      3,
      {
        regular: async () => {
          calls.push('regular')
          return false
        },
        waffo: async (amount, index) => {
          calls.push(`waffo:${amount}:${index}`)
          return true
        },
        waffoPancake: async () => {
          calls.push('pancake')
          return false
        },
      }
    )

    expect(success).toBe(true)
    expect(calls).toEqual(['waffo:120:3'])
  })

  test('does not create a Waffo order without a selected method index', async () => {
    let called = false
    const success = await dispatchSelectedPayment(
      { name: 'Waffo Card', type: PAYMENT_TYPES.WAFFO },
      120,
      null,
      {
        regular: async () => false,
        waffo: async () => {
          called = true
          return true
        },
        waffoPancake: async () => false,
      }
    )

    expect(success).toBe(false)
    expect(called).toBe(false)
  })
})
