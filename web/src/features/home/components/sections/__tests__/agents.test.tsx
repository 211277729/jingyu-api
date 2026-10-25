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

import { AGENT_APPLICATIONS } from '../../../constants'
import { Agents } from '../agents'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: (props: { to: string; children?: ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
}))

function renderAgents(status: Record<string, unknown> = {}) {
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

  render(<Agents />, { wrapper: Wrapper })
}

function anchorOf(text: string) {
  return screen.getByText(text).closest('a')
}

afterEach(cleanup)

describe('home page agent applications', () => {
  it('lists every configured agent', () => {
    renderAgents()

    for (const agent of AGENT_APPLICATIONS) {
      expect(screen.getByText(agent.name)).toBeInTheDocument()
    }
  })

  it('groups agents under the four advertised work types', () => {
    renderAgents()

    for (const category of ['Coding', 'Office', 'Research', 'Design']) {
      expect(screen.getAllByText(category).length).toBeGreaterThan(0)
    }
  })

  it('opens an agent official site in a new tab', () => {
    renderAgents()

    const link = anchorOf('Claude Code')

    expect(link).toHaveAttribute(
      'href',
      'https://www.anthropic.com/claude-code'
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('keeps an agent without an official site as a plain card', () => {
    renderAgents()

    expect(anchorOf('Hermes Agent')).toBeNull()
  })

  it('opens the built-in guide when the docs setting was never configured', () => {
    renderAgents()

    const link = anchorOf('View all agents')

    expect(link).toHaveAttribute('href', BUILT_IN_DOCS_PATH)
    expect(link).not.toHaveAttribute('target', '_blank')
  })

  it('opens a configured docs site in a new tab', () => {
    renderAgents({ docs_link: 'https://docs.example.com' })

    const link = anchorOf('View all agents')

    expect(link).toHaveAttribute('href', 'https://docs.example.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('links WorkBuddy to its official download page', () => {
    renderAgents()

    expect(anchorOf('WorkBuddy')).toHaveAttribute(
      'href',
      'https://www.codebuddy.cn/work/'
    )
  })
})
