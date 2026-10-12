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
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BUILT_IN_DOCS_PATH } from '@/lib/docs-link'

import { Hero } from '../hero'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: (props: { to: string; children?: ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
}))

function docsAnchor(status: Record<string, unknown>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], status)

  function Wrapper(props: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        {props.children}
      </QueryClientProvider>
    )
  }

  render(<Hero />, { wrapper: Wrapper })
  return screen.getByText('Docs').closest('a')
}

afterEach(cleanup)

describe('home page docs button', () => {
  it('opens the built-in guide when the setting has been cleared', () => {
    const link = docsAnchor({ docs_link: '' })

    expect(link).toHaveAttribute('href', BUILT_IN_DOCS_PATH)
    expect(link).not.toHaveAttribute('target', '_blank')
  })

  it('opens the built-in guide when the setting was never configured', () => {
    expect(docsAnchor({})).toHaveAttribute('href', BUILT_IN_DOCS_PATH)
  })

  it('opens a configured absolute URL in a new tab', () => {
    const link = docsAnchor({ docs_link: 'https://docs.example.com' })

    expect(link).toHaveAttribute('href', 'https://docs.example.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('routes a relative setting through the app router', () => {
    const link = docsAnchor({ docs_link: '/guide' })

    expect(link).toHaveAttribute('href', '/guide')
    expect(link).not.toHaveAttribute('target', '_blank')
  })
})
