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
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'

import {
  DEFAULT_CURRENCY_CONFIG,
  useSystemConfigStore,
} from '@/stores/system-config-store'

import { CachedPriceCell } from '../components/cached-price-cell'
import { ModelCard } from '../components/model-card'
import { ModelPriceCell } from '../components/model-price-cell'
import type { PricingModel } from '../types'

let storage: Map<string, string>
const originalStorage = useSystemConfigStore.persist.getOptions().storage
beforeEach(() => {
  storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() {
      return storage.size
    },
  })
  useSystemConfigStore.persist.setOptions({
    storage: createJSONStorage(() => localStorage),
  })
  useSystemConfigStore.getState().setConfig({
    currency: { ...DEFAULT_CURRENCY_CONFIG, quotaDisplayType: 'USD' },
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  useSystemConfigStore
    .getState()
    .setConfig({ currency: { ...DEFAULT_CURRENCY_CONFIG } })
  useSystemConfigStore.persist.setOptions({ storage: originalStorage })
})

describe('official price display', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows strikethrough official price in the price cell', () => {
    const model: PricingModel = {
      id: 1,
      model_name: 'gpt-test',
      quota_type: 0,
      model_ratio: 1,
      completion_ratio: 3,
      enable_groups: ['default'],
      official_price: {
        model_ratio: 5,
        exchange_rate: 1,
        completion_ratio: 3,
        cache_ratio: 0.1,
      },
    }
    render(<ModelPriceCell model={model} />)
    // Official input price = 5 * 2 = $10/1M, output = 5*2*3 = $30/1M
    const strikes = document.querySelectorAll('.line-through')
    expect(strikes.length).toBe(2)
    expect(strikes[0].textContent).toContain('10')
    expect(strikes[1].textContent).toContain('30')
  })

  it('strikes through the official cached price', () => {
    const model: PricingModel = {
      id: 2,
      model_name: 'gpt-test',
      quota_type: 0,
      model_ratio: 1,
      completion_ratio: 3,
      cache_ratio: 1,
      enable_groups: ['default'],
      official_price: {
        model_ratio: 5,
        exchange_rate: 1,
        completion_ratio: 3,
        cache_ratio: 0.1,
      },
    }
    render(<CachedPriceCell model={model} options={{}} />)
    const strikes = document.querySelectorAll('.line-through')
    expect(strikes.length).toBe(1)
    // Official cache price = 5*2*0.1 = $1/1M
    expect(strikes[0].textContent).toContain('1')
  })

  it('shows no strikethrough without official price data', () => {
    const model: PricingModel = {
      id: 3,
      model_name: 'gpt-test',
      quota_type: 0,
      model_ratio: 1,
      completion_ratio: 3,
      enable_groups: ['default'],
    }
    render(<ModelPriceCell model={model} />)
    expect(document.querySelectorAll('.line-through').length).toBe(0)
  })

  it('renders strikethrough official prices and discount badge on the model card', () => {
    const model: PricingModel = {
      id: 4,
      model_name: 'gpt-card-test',
      quota_type: 0,
      model_ratio: 1,
      completion_ratio: 3,
      enable_groups: ['default'],
      official_price: {
        model_ratio: 5,
        exchange_rate: 1,
        completion_ratio: 3,
      },
    }
    render(<ModelCard model={model} onClick={vi.fn()} tokenUnit='M' />)
    const strikes = document.querySelectorAll('.line-through')
    expect(strikes.length).toBe(2)
    // 折扣徽标:1/5=0.2 → 2折 (en: 80% off)
    const badge = screen.getAllByText(
      (_, el) => el?.textContent === '2折' || el?.textContent === '80% off'
    )
    expect(badge.length).toBeGreaterThan(0)
  })

  it('renders strikethrough official prices for dynamic (expression-billed) models', () => {
    const model: PricingModel = {
      id: 5,
      model_name: 'gpt-dynamic-test',
      quota_type: 0,
      model_ratio: 0,
      completion_ratio: 0,
      billing_mode: 'tiered_expr',
      billing_expr:
        'tier("standard", p * 0.3 + cr * 0.03 + cc * 0.375 + c * 0.9)',
      enable_groups: ['default'],
      official_price: {
        model_ratio: 5,
        exchange_rate: 1,
        completion_ratio: 3,
        cache_ratio: 0.1,
      },
    }
    render(<ModelPriceCell model={model} />)
    // 动态模型:输入 0.3 美元/1M 旁应有官方价 $10(5*2)划线
    const strikes = document.querySelectorAll('.line-through')
    expect(strikes.length).toBe(2)
    expect(strikes[0].textContent).toContain('10')
    // 折扣徽标由 ModelDiscountBadge 单测覆盖,这里只验证价格格子
  })

  it('converts the official price with the official USD exchange rate', () => {
    const model: PricingModel = {
      id: 6,
      model_name: 'gpt-rate-test',
      quota_type: 0,
      model_ratio: 1,
      completion_ratio: 3,
      enable_groups: ['default'],
      official_price: {
        model_ratio: 5,
        completion_ratio: 3,
        // 真实美元官方价按 7.3 汇率折算:5*2*7.3 = 73
        exchange_rate: 7.3,
      },
    }
    render(<ModelPriceCell model={model} />)
    const strikes = document.querySelectorAll('.line-through')
    expect(strikes.length).toBe(2)
    expect(strikes[0].textContent).toContain('73')
  })
})
