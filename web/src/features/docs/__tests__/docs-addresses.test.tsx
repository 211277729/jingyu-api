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

import { ToolGuides } from '../components/tool-guides'
import { DOCS_SECTION_IDS } from '../constants'
import { Docs } from '../index'

// The public shell owns the app router and header chrome, neither of which the
// docs page contributes; replacing them keeps this suite on the page itself.
vi.mock('@/components/layout', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/layout')>()),
  PublicLayout: (props: { children?: ReactNode }) => props.children,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: (props: { to: string; children?: ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
}))

const ORIGIN = 'https://gateway.example'
const OPENAI_BASE_URL = `${ORIGIN}/v1`

const STATUS = { server_address: ORIGIN }

const PRICING = {
  data: [
    {
      model_name: 'deepseek/deepseek-v4.1-flash',
      supported_endpoint_types: ['openai', 'openai-response'],
    },
  ],
  vendors: [],
  group_ratio: {},
  usable_group: {},
  supported_endpoint: {},
  auto_groups: [],
}

function renderWithCache(ui: React.ReactElement, status: object = STATUS) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  client.setQueryData(['status'], status)
  client.setQueryData(['pricing'], PRICING)

  function Wrapper(props: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        {props.children}
      </QueryClientProvider>
    )
  }

  return render(ui, { wrapper: Wrapper })
}

afterEach(cleanup)

describe('docs page addresses', () => {
  it('publishes the base URL built from the deployment server_address', () => {
    renderWithCache(<Docs />)

    expect(screen.getAllByText(OPENAI_BASE_URL).length).toBeGreaterThan(0)
  })

  it('exposes every anchor the index links to', () => {
    renderWithCache(<Docs />)

    for (const id of DOCS_SECTION_IDS) {
      expect(document.querySelector(`#${id}`)).not.toBeNull()
    }
    expect(
      screen.getByRole('navigation', { name: 'On this page' })
    ).toBeInTheDocument()
  })

  it('lists the models the gateway reports', () => {
    renderWithCache(<Docs />)

    expect(
      screen.getAllByText('deepseek/deepseek-v4.1-flash').length
    ).toBeGreaterThan(0)
  })
})

describe('tool base URLs', () => {
  it('gives Codex the /v1 base URL it appends /responses to', () => {
    render(<ToolGuides origin={ORIGIN} openAiBaseUrl={OPENAI_BASE_URL} />)

    expect(
      screen.getByText(/base_url = "https:\/\/gateway\.example\/v1"/, {
        selector: 'code',
      })
    ).toBeInTheDocument()
  })

  it('gives Claude Code the origin, because it posts to /v1/messages itself', () => {
    render(<ToolGuides origin={ORIGIN} openAiBaseUrl={OPENAI_BASE_URL} />)

    const settings = screen.getByText(/"ANTHROPIC_BASE_URL"/, {
      selector: 'code',
    })
    expect(settings.textContent).toContain(`"ANTHROPIC_BASE_URL": "${ORIGIN}"`)
    expect(settings.textContent).not.toContain('/v1')
  })

  it('pins Claude Code to an explicit model', () => {
    render(<ToolGuides origin={ORIGIN} openAiBaseUrl={OPENAI_BASE_URL} />)

    expect(
      screen.getByText(/"ANTHROPIC_MODEL"/, { selector: 'code' })
    ).toBeInTheDocument()
  })

  it('declares the harness provider with the OpenAI chat protocol', () => {
    render(<ToolGuides origin={ORIGIN} openAiBaseUrl={OPENAI_BASE_URL} />)

    const provider = screen.getByText(/api: openai-completions/, {
      selector: 'code',
    })
    expect(provider.textContent).toContain(`baseURL: ${OPENAI_BASE_URL}`)
  })
})
