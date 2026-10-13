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
import { requestPaymentAmount } from './use-payment'

describe('payment amount routing', () => {
  const baseCalculators = {
    regular: async () => {
      calls.push('regular')
      return { success: true, data: '1' }
    },
    stripe: async () => {
      calls.push('stripe')
      return { success: true, data: '2' }
    },
    waffo: async (request: { amount: number }) => {
      calls.push(`waffo:${request.amount}`)
      return { success: true, data: '18.75' }
    },
    waffoPancake: async () => {
      calls.push('pancake')
      return { success: true, data: '4' }
    },
    wxPay: async () => {
      calls.push('wxpay')
      return { success: true, data: '10' }
    },
  }
  let calls: string[] = []

  test('uses the dedicated Waffo amount calculator', async () => {
    calls = []
    const amount = await requestPaymentAmount(
      120,
      PAYMENT_TYPES.WAFFO,
      baseCalculators
    )

    expect(amount).toBe(18.75)
    expect(calls).toEqual(['waffo:120'])
  })

  test('uses the dedicated WeChat Pay amount calculator', async () => {
    calls = []
    const amount = await requestPaymentAmount(
      10,
      PAYMENT_TYPES.WXPAY_OFFICIAL,
      baseCalculators
    )

    expect(amount).toBe(10)
    expect(calls).toEqual(['wxpay'])
  })
})
