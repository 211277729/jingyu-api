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
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { NAV_CATEGORIES } from '../../constants'
import { CategoryNav } from '../category-nav'

describe('navigation category list', () => {
  it('renders one entry per category with its site count', () => {
    render(<CategoryNav categories={NAV_CATEGORIES} activeId='coding' />)

    for (const category of NAV_CATEGORIES) {
      const link = screen.getByText(category.labelKey).closest('a')

      expect(link).toHaveAttribute('href', `#nav-category-${category.id}`)
      expect(link).toHaveTextContent(String(category.sites.length))
    }
  })

  it('scrolls to the matching section when a category is clicked', async () => {
    const section = document.createElement('section')
    section.id = 'nav-category-coding'
    document.body.append(section)
    const scrollIntoView = vi.spyOn(section, 'scrollIntoView')

    render(<CategoryNav categories={NAV_CATEGORIES} activeId='chat' />)
    await userEvent.click(screen.getByText('Coding'))

    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    section.remove()
  })

  it('marks only the active category for assistive technology', () => {
    render(<CategoryNav categories={NAV_CATEGORIES} activeId='coding' />)

    expect(screen.getByText('Coding').closest('a')).toHaveAttribute(
      'aria-current',
      'true'
    )
    expect(
      screen.getByText('Chat Assistants').closest('a')
    ).not.toHaveAttribute('aria-current')
  })
})
