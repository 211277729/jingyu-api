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
import { cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { type TopNavLink, useTopNavLinks } from '../use-top-nav-links'

function docsEntry(status: Record<string, unknown>): TopNavLink | undefined {
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

  const { result } = renderHook(() => useTopNavLinks(), { wrapper: Wrapper })
  return result.current.find((link) => link.title === 'Docs')
}

afterEach(cleanup)

describe('Docs navigation entry', () => {
  it('opens a configured absolute URL in a new tab', () => {
    const link = docsEntry({ docs_link: 'https://docs.example.com' })

    expect(link).toMatchObject({
      href: 'https://docs.example.com',
      external: true,
    })
  })

  it('routes a relative docs_link through the in-site router', () => {
    const link = docsEntry({ docs_link: '/guide' })

    expect(link).toMatchObject({ href: '/guide' })
    expect(link?.external).toBeFalsy()
  })

  it('falls back to the built-in /docs guide when docs_link is empty', () => {
    const link = docsEntry({ docs_link: '' })

    expect(link).toMatchObject({ href: '/docs' })
    expect(link?.external).toBeFalsy()
  })

  it('omits the entry when the docs module is disabled', () => {
    expect(docsEntry({ HeaderNavModules: '{"docs":false}' })).toBeUndefined()
  })
})

function navEntry(status: Record<string, unknown>): TopNavLink | undefined {
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

  const { result } = renderHook(() => useTopNavLinks(), { wrapper: Wrapper })
  return result.current.find((link) => link.title === 'AI Navigation')
}

describe('AI navigation entry', () => {
  it('links to the directory by default', () => {
    expect(navEntry({})).toMatchObject({ href: '/nav' })
  })

  it('sits right after the home link', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    client.setQueryData(['status'], {})

    function Wrapper(props: { children: ReactNode }) {
      return (
        <QueryClientProvider client={client}>
          {props.children}
        </QueryClientProvider>
      )
    }

    const { result } = renderHook(() => useTopNavLinks(), { wrapper: Wrapper })
    const titles = result.current.map((link) => link.title)

    expect(titles.slice(0, 3)).toEqual(['Home', 'AI Navigation', 'Console'])
  })

  it('omits the entry when the admin disabled it', () => {
    expect(
      navEntry({ HeaderNavModules: '{"nav":{"enabled":false}}' })
    ).toBeUndefined()
  })

  it('marks the entry as auth-gated when the admin requires login', () => {
    expect(
      navEntry({
        HeaderNavModules: '{"nav":{"enabled":true,"requireAuth":true}}',
      })
    ).toMatchObject({ href: '/nav', requiresAuth: true })
  })
})
