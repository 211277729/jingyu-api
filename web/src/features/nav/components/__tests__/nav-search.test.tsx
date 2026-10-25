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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { NavCategory } from '../../types'
import { NavSearch } from '../nav-search'

const categories: NavCategory[] = [
  {
    id: 'chat',
    labelKey: 'Chat Assistants',
    sites: [
      { name: 'ChatGPT', url: 'https://chatgpt.com' },
      { name: 'Claude', url: 'https://claude.ai' },
    ],
  },
  {
    id: 'coding',
    labelKey: 'Coding',
    sites: [
      { name: 'GitHub Copilot', url: 'https://github.com/features/copilot' },
    ],
  },
]

function setup() {
  const onPreview = vi.fn()
  const onSelect = vi.fn()
  render(
    <NavSearch
      categories={categories}
      onPreview={onPreview}
      onSelect={onSelect}
    />
  )
  return {
    onPreview,
    onSelect,
    input: screen.getByRole('combobox'),
  }
}

describe('directory search field', () => {
  it('lists the sites a query matches', async () => {
    const { input } = setup()
    const user = userEvent.setup()

    await user.type(input, 'claude')

    expect(await screen.findByRole('option', { name: /Claude/ })).toBeVisible()
    expect(screen.getAllByRole('option')).toHaveLength(1)
  })

  it('does not open a result list before anything is typed', () => {
    setup()

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('selects the best match on Enter', async () => {
    const { input, onSelect } = setup()
    const user = userEvent.setup()

    await user.type(input, 'github{Enter}')

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0][0]).toMatchObject({
      kind: 'site',
      site: { name: 'GitHub Copilot' },
    })
  })

  it('moves the active option with the arrow keys', async () => {
    const { input } = setup()
    const user = userEvent.setup()

    await user.type(input, 'a')
    const options = await screen.findAllByRole('option')
    expect(options.length).toBeGreaterThan(1)
    expect(options[0]).toHaveAttribute('aria-selected', 'true')

    await user.keyboard('{ArrowDown}')

    expect(screen.getAllByRole('option')[1]).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  it('clears the query and the preview on Escape', async () => {
    const { input, onPreview } = setup()
    const user = userEvent.setup()

    await user.type(input, 'claude')
    onPreview.mockClear()

    await user.keyboard('{Escape}')

    expect(input).toHaveValue('')
    expect(onPreview).toHaveBeenCalledWith(null)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('previews the best match while typing, without waiting for Enter', async () => {
    const { input, onPreview } = setup()
    const user = userEvent.setup()

    await user.type(input, 'claude')

    await waitFor(() =>
      expect(onPreview).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'site' })
      )
    )
  })

  it('reports when nothing matches', async () => {
    const { input } = setup()
    const user = userEvent.setup()

    await user.type(input, 'midjourney')

    expect(await screen.findByText('No matching tools')).toBeVisible()
    expect(screen.queryAllByRole('option')).toHaveLength(0)
  })
})
