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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { AGPL_LICENSE_URL, SOURCE_REPOSITORY_URL } from '@/lib/constants'

vi.mock('@/components/layout', () => ({
  PublicLayout: (props: { children: React.ReactNode }) => (
    <div>{props.children}</div>
  ),
}))

const { Licensing } = await import('../index')

/**
 * The section 13 source offer is a licence obligation, not a design choice.
 * These assertions protect the parts that make the offer valid even when the
 * visible copy is deliberately quiet: the link must exist in the markup, it
 * must point at the real repository, and the section 5(a) statement that this
 * deployment is modified must stay on the page.
 */
describe('licensing notice', () => {
  test('source offer stays in the document while collapsed by default', async () => {
    render(<Licensing />)
    const sourceLink = screen.getByRole('link', {
      name: SOURCE_REPOSITORY_URL,
    })
    expect(sourceLink).toHaveAttribute('href', SOURCE_REPOSITORY_URL)
    // Reachable without expanding: a collapsed <details> still exposes its
    // subtree to the accessibility tree lookup above, so the offer exists even
    // though the copy around it never names the repository.
    const disclosure = sourceLink.closest('details')
    expect(disclosure).not.toBeNull()
    expect(disclosure).not.toHaveAttribute('open')
  })

  test('expanding related documents reveals the source location', async () => {
    const user = userEvent.setup()
    render(<Licensing />)
    const disclosure = screen
      .getByRole('link', { name: SOURCE_REPOSITORY_URL })
      .closest('details')
    expect(disclosure).not.toBeNull()
    await user.click(
      within(disclosure as HTMLElement).getByText(/.+/i, {
        selector: 'summary',
      })
    )
    expect(disclosure).toHaveAttribute('open')
  })

  test('licence text is linked in both the body and the related block', () => {
    render(<Licensing />)
    const licenceLinks = screen.getAllByRole('link', {
      name: 'GNU Affero General Public License v3.0',
    })
    // Section 13 keeps the licence reachable from the readable copy; the
    // related block repeats it for anyone who lands on the collapsed footer.
    expect(licenceLinks.length).toBeGreaterThanOrEqual(2)
    for (const link of licenceLinks) {
      expect(link).toHaveAttribute('href', AGPL_LICENSE_URL)
    }
  })

  test('states that this deployment is modified', () => {
    render(<Licensing />)
    // AGPLv3 5(a): a modified version must carry a prominent modification
    // notice. Losing this sentence is a licence violation, not a copy tweak.
    expect(
      screen.getByText(/modifications to the original work/i)
    ).toBeInTheDocument()
  })
})
