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

import type { PricingModel } from '../../types'
import { calculateOfficialTokenPrice, getOfficialTimeTier } from '../lib/price'

// DeepSeek 风格高峰/低峰表达式:工作日 9-12 与 14-18 为高峰
const timeExpression =
  'weekday("Asia/Shanghai") >= 1 && weekday("Asia/Shanghai") <= 5 && ((hour("Asia/Shanghai") >= 9 && hour("Asia/Shanghai") < 12) || (hour("Asia/Shanghai") >= 14 && hour("Asia/Shanghai") < 18)) ? tier("peak", p * 3 + cr * 0.1 + c * 9) : tier("off_peak", p * 1.5 + cr * 0.05 + c * 4.5)'

function pricingModel(overrides: Partial<PricingModel>): PricingModel {
  return {
    id: 1,
    model_name: 'test-model',
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    billing_mode: 'tiered_expr',
    enable_groups: ['default'],
    ...overrides,
  }
}

// 官方价:低峰 $0.075/1M(model_ratio 0.0375)、高峰 $0.15/1M(2 倍)
function withPeakPrices(overrides: Partial<PricingModel> = {}): PricingModel {
  return pricingModel({
    billing_expr: timeExpression,
    official_price: {
      model_ratio: 0.0375,
      completion_ratio: 4,
      peak_model_ratio: 0.075,
      peak_completion_ratio: 4,
      exchange_rate: 7.3,
    },
    ...overrides,
  })
}

describe('getOfficialTimeTier', () => {
  test('resolves peak during peak hours and off-peak otherwise', () => {
    const model = withPeakPrices()
    // 周一 10:00 北京时间 = 高峰
    expect(
      getOfficialTimeTier(model, new Date('2026-09-07T10:00:00+08:00'))
    ).toBe('peak')
    // 周一 12:30 北京时间 = 低峰
    expect(
      getOfficialTimeTier(model, new Date('2026-09-07T12:30:00+08:00'))
    ).toBe('off_peak')
  })

  test('returns null without peak prices or without time tiers', () => {
    // 没配高峰价
    expect(
      getOfficialTimeTier(
        withPeakPrices({
          official_price: {
            model_ratio: 0.0375,
            completion_ratio: 4,
            exchange_rate: 7.3,
          },
        }),
        new Date('2026-09-07T10:00:00+08:00')
      )
    ).toBeNull()
    // 非时段计费模型
    expect(
      getOfficialTimeTier(
        withPeakPrices({ billing_expr: '' }),
        new Date('2026-09-07T10:00:00+08:00')
      )
    ).toBeNull()
  })
})

describe('calculateOfficialTokenPrice with peak tier', () => {
  test('uses the tier matching the current billing period', () => {
    const model = withPeakPrices()
    // 高峰时段:官方输入价 $0.15/1M = 0.075 * 2
    expect(
      calculateOfficialTokenPrice(
        model,
        'input',
        new Date('2026-09-07T10:00:00+08:00')
      )
    ).toBeCloseTo(0.075 * 2 * 7.3, 10)
    // 低峰时段:官方输入价 $0.075/1M = 0.0375 * 2
    expect(
      calculateOfficialTokenPrice(
        model,
        'input',
        new Date('2026-09-07T12:30:00+08:00')
      )
    ).toBeCloseTo(0.0375 * 2 * 7.3, 10)
  })

  test('falls back to the base tier without peak data', () => {
    const model = withPeakPrices({
      official_price: {
        model_ratio: 0.0375,
        completion_ratio: 4,
        exchange_rate: 7.3,
      },
    })
    expect(
      calculateOfficialTokenPrice(
        model,
        'input',
        new Date('2026-09-07T10:00:00+08:00')
      )
    ).toBeCloseTo(0.0375 * 2 * 7.3, 10)
  })
})
