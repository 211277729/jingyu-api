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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { MonitoringSettingsSection } from '../monitoring-settings-section'

const defaults = {
  QuotaRemindThreshold: '',
  'perf_metrics_setting.enabled': true,
  'perf_metrics_setting.flush_interval': 5,
  'perf_metrics_setting.bucket_time': 'hour',
  'perf_metrics_setting.retention_days': 0,
  'perf_metrics_setting.published_bucket': 'short',
  'perf_metrics_setting.published_prompt_token_limit': 8000,
  'perf_metrics_setting.published_note': '',
  'perf_metrics_setting.published_tps_factor': 1,
  'perf_metrics_setting.published_tps_floor': 0,
  'perf_metrics_setting.published_tps_ceiling': 0,
} as const

async function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <SettingsPageProvider actionsContainer={null}>
        <MonitoringSettingsSection defaultValues={{ ...defaults }} />
      </SettingsPageProvider>
    </QueryClientProvider>
  )
  return screen.findByLabelText('Published latency scope')
}

beforeEach(() => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: null },
  })
  vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
})

test('the published scope row keeps its three controls on one line', async () => {
  await renderSection()

  // 该行各列的行数不同（只有部分列带说明文字）。列若被拉伸，内容较少的那列会
  // 把多余高度分摊到各行，控件比邻列低约 14px，因此这一行必须按顶部对齐。
  const row = screen
    .getByLabelText('Published latency scope')
    .closest('[data-slot="form-item"]')?.parentElement

  expect(row).not.toBeNull()
  expect(row?.className).toContain('items-start')
  expect(row?.className).toContain('md:grid-cols-3')
  expect(row?.querySelectorAll('[data-slot="form-item"]')).toHaveLength(3)
})

test('the row exposes the scope switch, its limit and its note', async () => {
  await renderSection()

  expect(screen.getByLabelText('Standard chat input token limit')).toHaveValue(
    8000
  )
  expect(screen.getByLabelText('Published scope note')).toHaveValue('')
})

test('the published throughput row exposes the factor, floor and ceiling', async () => {
  await renderSection()

  expect(screen.getByLabelText('Published throughput factor')).toHaveValue(1)
  expect(screen.getByLabelText('Published throughput floor')).toHaveValue(0)
  expect(screen.getByLabelText('Published throughput ceiling')).toHaveValue(0)
})

test('the published throughput row keeps its three controls on one line', async () => {
  await renderSection()

  // 与延迟口径那一行同样的横向对齐要求：只有一列带说明文字，列被拉伸就会把控件推低。
  const row = screen
    .getByLabelText('Published throughput factor')
    .closest('[data-slot="form-item"]')?.parentElement

  expect(row).not.toBeNull()
  expect(row?.className).toContain('items-start')
  expect(row?.className).toContain('md:grid-cols-3')
  expect(row?.querySelectorAll('[data-slot="form-item"]')).toHaveLength(3)
})
