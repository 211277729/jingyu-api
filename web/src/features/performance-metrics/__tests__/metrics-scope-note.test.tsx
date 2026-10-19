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
import { render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { expect, it } from 'vitest'

import { MetricsScopeNote } from '../components/metrics-scope-note'

it('states the scope when the published numbers cover a subset', () => {
  render(<MetricsScopeNote scope={{ mode: 'short', prompt_token_limit: 8000 }} />)

  const expected = i18next.t(
    'Latency and throughput cover standard chat requests (input \u2264{{limit}} tokens) \u00b7 last 24 hours',
    { limit: 8000 }
  )
  expect(screen.getByText(expected)).toBeInTheDocument()
})

it('prefers the operator note over the built-in sentence', () => {
  render(
    <MetricsScopeNote
      scope={{ mode: 'short', prompt_token_limit: 8000, note: '标准对话统计' }}
    />
  )

  expect(screen.getByText('标准对话统计')).toBeInTheDocument()
  expect(
    screen.queryByText(/standard chat requests/i, { exact: false })
  ).not.toBeInTheDocument()
})

it('renders nothing for the full population', () => {
  const { container } = render(<MetricsScopeNote />)
  const full = render(<MetricsScopeNote scope={{ mode: 'all' }} />)

  expect(container).toBeEmptyDOMElement()
  expect(full.container).toBeEmptyDOMElement()
})

it('keeps the caller inset so the note shares the layout line of its siblings', () => {
  const { container } = render(
    <MetricsScopeNote
      scope={{ mode: 'short', prompt_token_limit: 8000 }}
      className='px-4'
    />
  )

  expect(container.firstElementChild?.className).toContain('px-4')
})
