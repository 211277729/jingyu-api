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
// 线上真实数据回归:claude-haiku-5-5 表达式计费 + 0.35 分组折扣 → 3.5折
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ModelDiscountBadge } from '../components/model-discount-badge'
import fixture from './live-model-fixture.json'

afterEach(() => cleanup())

describe('live model discount badge', () => {
  it('compares the live claude-haiku-5-5 model against the exchange-rate-converted official price', () => {
    const model = fixture.model as never
    render(<ModelDiscountBadge model={model} />)
    // 站内基础价 0.1 USD/1M × 分组 0.35 = 0.035(额度口径,1:1 人民币);
    // 官方价 0.05*2 真实美元 × 汇率 7.3 = 0.73 → 折扣 0.035/0.73 ≈ 0.5折 (en: 95% off)
    const badge = screen.getAllByText(
      (_, el) => el?.textContent === '0.5折' || el?.textContent === '95% off'
    )
    expect(badge.length).toBeGreaterThan(0)
  })
})
