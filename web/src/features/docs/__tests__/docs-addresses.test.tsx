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

import { useAuthStore } from '@/stores/auth-store'

import { generateSetupCode } from '../api'
import { AiSetupCard } from '../components/ai-setup-card'
import { ToolGuides } from '../components/tool-guides'
import { DOCS_SECTION_IDS } from '../constants'
import { Docs } from '../index'

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  generateSetupCode: vi.fn(),
}))

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

  it('offers both base URL variants, one per client family', () => {
    renderWithCache(<Docs />)

    expect(screen.getByText('OpenAI-compatible clients')).toBeInTheDocument()
    expect(
      screen.getByText('Anthropic clients (Claude Code)')
    ).toBeInTheDocument()
    expect(screen.getByText(ORIGIN, { selector: 'code' })).toBeInTheDocument()
  })
})

describe('quick start and verify sections', () => {
  it('renders the four quick-start steps with links into the details', () => {
    renderWithCache(<Docs />)

    expect(screen.getByText('Check your balance')).toBeInTheDocument()
    expect(screen.getByText('Create an API key')).toBeInTheDocument()
    expect(screen.getByText('Connect your tool')).toBeInTheDocument()
    expect(screen.getByText('Verify the connection')).toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: 'Open API Keys' }).length
    ).toBeGreaterThan(0)
  })

  it('walks through creating a key with the exact UI labels', () => {
    renderWithCache(<Docs />)

    expect(
      screen.getByText(/click the "Create API Key" button/)
    ).toBeInTheDocument()
    expect(screen.getByText(/choose "Copy Key"/)).toBeInTheDocument()
  })

  it('shows what a successful response looks like in the verify section', () => {
    renderWithCache(<Docs />)

    expect(
      screen.getByText(/"object": "chat\.completion"/, { selector: 'code' })
    ).toBeInTheDocument()
  })

  it('links each tool guide card from the quick-jump chips', () => {
    renderWithCache(<Docs />)

    for (const id of ['cc-switch', 'magpie', 'claude-code', 'codex', 'deepseek-harness']) {
      expect(document.querySelector(`#${id}`)).not.toBeNull()
    }
    expect(
      screen.getByRole('link', { name: 'CC Switch' })
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Magpie' })).toBeInTheDocument()
  })
})

describe('tool base URLs', () => {
  it('points CC Switch at its official site instead of GitHub', () => {
    render(<ToolGuides origin={ORIGIN} openAiBaseUrl={OPENAI_BASE_URL} />)

    const install = screen.getByText(/brew install --cask cc-switch/, {
      selector: 'code',
    })
    expect(install.textContent).toContain('https://ccswitch.io/zh/')
    expect(install.textContent).not.toContain('github.com')
  })

  it('gives Magpie its official site and the /v1 base URL', () => {
    render(<ToolGuides origin={ORIGIN} openAiBaseUrl={OPENAI_BASE_URL} />)

    expect(screen.getByText('Magpie')).toBeInTheDocument()
    const install = screen.getByText(/usemagpie\.ai\/zh\//, {
      selector: 'code',
    })
    expect(install.textContent).toContain('https://usemagpie.ai/zh/')
    const provider = screen.getByText(
      /Add a custom provider with this base URL/,
      { exact: false }
    )
    expect(provider).toBeInTheDocument()
  })

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

describe('AI setup card', () => {
  afterEach(() => {
    useAuthStore.getState().auth.setUser(null)
    vi.mocked(generateSetupCode).mockReset()
  })

  it('keeps the prompt collapsed until the reader expands it', async () => {
    render(<AiSetupCard origin={ORIGIN} />)

    expect(
      screen.queryByText(/Read https:\/\/gateway\.example\/llms\.txt/)
    ).not.toBeInTheDocument()
    const { userEvent } = await import('@testing-library/user-event')
    await userEvent.click(
      screen.getByRole('button', { name: 'View the full prompt' })
    )

    const prompt = screen.getByText(/Read https:\/\/gateway\.example\/llms\.txt/)
    expect(prompt.textContent).toContain('ask me for my sk- API key')
  })

  it('links signed-out visitors to sign-in instead of offering a setup code', () => {
    render(<AiSetupCard origin={ORIGIN} />)

    expect(
      screen.getByRole('link', { name: 'Sign in to generate a setup code' })
    ).toHaveAttribute('href', '/sign-in')
    expect(
      screen.queryByRole('button', { name: 'Generate a setup code' })
    ).not.toBeInTheDocument()
  })

  it('rewrites the prompt to include the setup code once generated', async () => {
    const user = { id: 1, username: 'tester' } as never
    useAuthStore.getState().auth.setUser(user)
    vi.mocked(generateSetupCode).mockResolvedValue({
      success: true,
      data: { code: 'ABCD2345EFGH6789', expires_in: 600 },
    })

    render(<AiSetupCard origin={ORIGIN} />)
    const { userEvent } = await import('@testing-library/user-event')
    await userEvent.click(
      screen.getByRole('button', { name: 'Generate a setup code' })
    )

    expect(await screen.findByText('ABCD2345EFGH6789')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'View the full prompt' })
    )
    const prompt = screen.getByText(/My one-time setup code is ABCD2345EFGH6789/)
    expect(prompt.textContent).toContain('/api/setup_code/redeem')
  })

  it('renders on the full docs page with the signed-out variant', () => {
    renderWithCache(<Docs />)

    expect(screen.getByText('Configure with AI')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Sign in to generate a setup code' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'View the full prompt' })
    ).toBeInTheDocument()
  })
})
