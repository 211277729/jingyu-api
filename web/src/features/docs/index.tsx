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
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Bot,
  Boxes,
  CircleCheck,
  Copy,
  HelpCircle,
  KeyRound,
  Plug,
  Route,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { PublicHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import { cn } from '@/lib/utils'

import { AiSetupCard } from './components/ai-setup-card'
import { CodeBlock } from './components/code-block'
import { CurlExamples } from './components/curl-examples'
import { DocsIndex } from './components/docs-index'
import { DocsSection } from './components/docs-section'
import { EndpointTable, type EndpointRow } from './components/endpoint-table'
import { FaqList } from './components/faq-list'
import { GatewayConstellation } from './components/gateway-constellation'
import { ModelList } from './components/model-list'
import { QuickStart } from './components/quick-start'
import { StepList, type StepItem } from './components/step-list'
import { ToolGuides } from './components/tool-guides'
import { DOCS_ENDPOINTS } from './constants'

/** Anchor ids of the individual tool guide cards, for the quick-jump chips. */
const TOOL_GUIDE_ANCHORS = [
  { id: 'cc-switch', labelKey: 'CC Switch' },
  { id: 'magpie', labelKey: 'Magpie' },
  { id: 'claude-code', labelKey: 'Claude Code' },
  { id: 'codex', labelKey: 'Codex' },
  { id: 'deepseek-harness', labelKey: 'DeepSeek Harness' },
] as const

/**
 * Accent tint per setup-path card. The docs console is always dark, so the
 * chips use fixed neon tints instead of theme tokens.
 */
const PATH_TONES = {
  primary: 'bg-violet-500/15 text-violet-300 ring-violet-400/30',
  success: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  info: 'bg-cyan-500/15 text-cyan-300 ring-cyan-400/30',
} as const

/**
 * Abbreviated OpenAI Chat Completions reply shown in the verify section so
 * first-time users know what success looks like before they run anything.
 */
const SUCCESS_RESPONSE_EXAMPLE = `{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "model": "MODEL_ID",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 9, "completion_tokens": 12, "total_tokens": 21 }
}`

/**
 * The docs page as an immersive, always-dark developer console. It departs
 * from the site theme on purpose (the site gets redesigned page by page), so
 * every color below is a fixed zinc/violet/cyan palette, not a token.
 *
 * The page composes `PublicHeader` directly under a `dark` class scope: the
 * shared header is transparent when not scrolled and uses token text colors,
 * which would otherwise vanish against this dark canvas in light mode.
 */
export function Docs() {
  const { t } = useTranslation()
  const { serverAddress } = useChatPresets()

  const origin = useMemo(
    () => serverAddress.replace(/\/+$/, ''),
    [serverAddress]
  )
  const openAiBaseUrl = `${origin}/v1`

  const setupPaths: {
    id: string
    href: string
    tone: keyof typeof PATH_TONES
    icon: typeof Bot
    title: string
    desc: string
  }[] = useMemo(
    () => [
      {
        id: 'ai-setup',
        href: '#ai-setup',
        tone: 'primary',
        icon: Bot,
        title: t('Let an AI agent do it'),
        desc: t(
          'The fastest path: generate a setup code and paste one prompt.'
        ),
      },
      {
        id: 'cc-switch',
        href: '#cc-switch',
        tone: 'success',
        icon: Plug,
        title: t('One-click switcher'),
        desc: t('CC Switch rewrites your tool config files for you.'),
      },
      {
        id: 'quick-start',
        href: '#quick-start',
        tone: 'info',
        icon: Zap,
        title: t('Follow the steps'),
        desc: t('Numbered steps with copy-ready snippets.'),
      },
    ],
    [t]
  )

  const endpointRows: EndpointRow[] = useMemo(
    () =>
      DOCS_ENDPOINTS.map((endpoint) => ({
        method: endpoint.method,
        path: endpoint.path,
        protocol: t(endpoint.protocolKey),
        auth: endpoint.auth,
        purpose: t(endpoint.purposeKey),
      })),
    [t]
  )

  const apiKeySteps: StepItem[] = useMemo(
    () => [
      {
        text: t(
          'Open the API Keys page and click the "Create API Key" button in the top right corner.'
        ),
      },
      {
        text: t(
          'Fill in a name, keep the defaults for group and expiry, then save.'
        ),
      },
      {
        text: t(
          'Back on the list, open the row actions menu of the new key and choose "Copy Key" to copy the sk-… value. You can copy it again at any time.'
        ),
      },
      {
        text: t(
          'Keep the key private: anyone who holds it can spend your balance.'
        ),
      },
    ],
    [t]
  )

  return (
    // The `dark` class scopes the app's dark token values to this subtree in
    // every site theme, so the shared PublicHeader renders as dark glass on
    // the always-dark console instead of disappearing in light mode.
    <div className='dark relative min-h-svh overflow-x-clip bg-zinc-950 text-zinc-100'>
      <PublicHeader />
      {/* Page-level ambience: top aurora wash + faint dot grid. */}
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(139,92,246,0.16),transparent_70%)]'
      />
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] [background-size:28px_28px]'
      />

      <div className='relative mx-auto max-w-6xl px-4 pt-24 pb-24 sm:px-6'>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <header className='space-y-4'>
          <section className='relative overflow-hidden rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-5 py-10 ring-1 ring-white/10 sm:px-10 sm:py-12'>
            <div
              aria-hidden='true'
              className='pointer-events-none absolute -top-24 -left-16 size-80 rounded-full bg-violet-500/20 blur-3xl'
            />
            <div
              aria-hidden='true'
              className='pointer-events-none absolute -right-20 -bottom-32 size-96 rounded-full bg-cyan-400/15 blur-3xl'
            />

            <div className='relative space-y-8'>
              <div className='max-w-3xl space-y-4'>
                <span className='inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300 ring-1 ring-white/15'>
                  <Sparkles className='size-3' aria-hidden='true' />
                  {t('About 5 minutes to your first reply')}
                </span>
                <h1 className='w-fit bg-gradient-to-r from-white via-violet-200 to-cyan-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-5xl'>
                  {t('One gateway for every AI tool and agent')}
                </h1>
                <p className='max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base'>
                  {t(
                    'Claude Code, Codex, Gemini CLI, GUI switchers and any OpenAI- or Anthropic-compatible client connect through one base URL and one key.'
                  )}
                </p>
              </div>

              <GatewayConstellation />

              {/* Command bar: the two base URLs every client needs. */}
              <div className='overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/10'>
                <div className='flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-2.5'>
                  <span className='size-2.5 rounded-full bg-red-400 opacity-70' />
                  <span className='size-2.5 rounded-full bg-amber-400 opacity-70' />
                  <span className='size-2.5 rounded-full bg-emerald-400 opacity-70' />
                  <span className='ml-2 font-mono text-xs text-zinc-500'>
                    BASE_URL
                  </span>
                </div>
                <div className='divide-y divide-white/[0.06]'>
                  <div className='grid items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[220px_1fr_auto]'>
                    <span className='text-xs font-semibold tracking-wide text-zinc-400'>
                      {t('OpenAI-compatible clients')}
                    </span>
                    <code className='font-mono text-sm break-all text-zinc-50'>
                      {openAiBaseUrl}
                    </code>
                    <CopyButton
                      value={openAiBaseUrl}
                      className='justify-self-end text-zinc-400 hover:bg-white/10 hover:text-zinc-100'
                      iconClassName='size-3.5'
                    />
                  </div>
                  <div className='grid items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[220px_1fr_auto]'>
                    <span className='text-xs font-semibold tracking-wide text-zinc-400'>
                      {t('Anthropic clients (Claude Code)')}
                    </span>
                    <code className='font-mono text-sm break-all text-zinc-50'>
                      {origin}
                    </code>
                    <CopyButton
                      value={origin}
                      className='justify-self-end text-zinc-400 hover:bg-white/10 hover:text-zinc-100'
                      iconClassName='size-3.5'
                    />
                  </div>
                </div>
                <p className='px-4 py-3 text-xs leading-relaxed text-zinc-500'>
                  {t(
                    'OpenAI-compatible clients use the /v1 address. Anthropic clients such as Claude Code append /v1/messages themselves, so they take the origin only.'
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* Setup-path decision cards */}
          <ul className='grid gap-3 sm:grid-cols-3'>
            {setupPaths.map((path) => (
              <li key={path.id}>
                <a
                  href={path.href}
                  className='group flex h-full items-center gap-3 rounded-xl bg-white/[0.03] p-3.5 text-start ring-1 ring-white/10 transition-colors hover:bg-violet-500/[0.06] hover:ring-violet-400/40'
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 [&>svg]:size-4',
                      PATH_TONES[path.tone]
                    )}
                    aria-hidden='true'
                  >
                    <path.icon />
                  </span>
                  <span className='min-w-0 flex-1'>
                    <span className='block text-sm font-semibold text-white'>
                      {path.title}
                    </span>
                    <span className='mt-0.5 block text-xs leading-relaxed text-zinc-400'>
                      {path.desc}
                    </span>
                  </span>
                  <ArrowRight
                    className='size-4 shrink-0 text-zinc-600 transition-all group-hover:translate-x-0.5 group-hover:text-violet-300'
                    aria-hidden='true'
                  />
                </a>
              </li>
            ))}
          </ul>

          {/* Fast lane: AI-driven setup */}
          <div id='ai-setup' className='scroll-mt-24'>
            <AiSetupCard origin={origin} />
          </div>
        </header>

        {/* ── Body: TOC rail + sections ────────────────────────── */}
        <div className='mt-14 grid gap-8 lg:grid-cols-[11rem_1fr] lg:gap-12'>
          <DocsIndex />

          <div className='min-w-0 space-y-6'>
            <DocsSection
              id='quick-start'
              index='01'
              icon={<Zap />}
              title={t('Quick Start')}
              description={t(
                'Four steps from zero to a working client. Follow them in order.'
              )}
            >
              <QuickStart />
            </DocsSection>

            <DocsSection
              id='api-key'
              index='02'
              icon={<KeyRound />}
              title={t('Get an API Key')}
              description={t(
                'An empty balance fails with a quota error, not an authentication error, so keep a positive balance too.'
              )}
            >
              <div className='space-y-5'>
                <StepList steps={apiKeySteps} />
                <div className='flex flex-wrap gap-2.5'>
                  <Button
                    render={
                      <Link
                        to='/keys'
                        target='_blank'
                        rel='noopener noreferrer'
                      />
                    }
                  >
                    {t('API Keys')}
                  </Button>
                  <Button
                    variant='secondary'
                    className='bg-white/10 text-white shadow-none ring-1 ring-white/15 hover:bg-white/15'
                    render={
                      <Link
                        to='/wallet'
                        target='_blank'
                        rel='noopener noreferrer'
                      />
                    }
                  >
                    {t('Wallet')}
                  </Button>
                </div>
              </div>
            </DocsSection>

            <DocsSection
              id='endpoints'
              index='03'
              icon={<Route />}
              title={t('API Endpoints')}
              description={t(
                'All four routes take the same token. Paths are relative to the base URL above.'
              )}
            >
              <div className='space-y-4'>
                <EndpointTable rows={endpointRows} />
                <p className='flex items-center gap-2 text-xs text-zinc-500'>
                  <Copy className='size-3.5 shrink-0' aria-hidden='true' />
                  {t(
                    'Both headers carry the same token. The Anthropic route also requires an anthropic-version header.'
                  )}
                </p>
              </div>
            </DocsSection>

            <DocsSection
              id='verify'
              index='04'
              icon={<CircleCheck />}
              title={t('Verify the Connection')}
              description={t(
                'Copy a snippet, replace the key, and run it. A JSON reply means the base URL and the token are correct.'
              )}
            >
              <div className='space-y-4'>
                <CurlExamples baseUrl={openAiBaseUrl} />
                <div>
                  <h3 className='text-sm font-semibold text-white'>
                    {t('Successful response')}
                  </h3>
                  <p className='mt-1 mb-2 text-xs text-zinc-500'>
                    {t(
                      'A successful chat completion looks like this (abridged). Anything else is an error you can act on.'
                    )}
                  </p>
                  <CodeBlock
                    label={t('Successful response')}
                    code={SUCCESS_RESPONSE_EXAMPLE}
                  />
                </div>
              </div>
            </DocsSection>

            <DocsSection
              id='models'
              index='05'
              icon={<Boxes />}
              title={t('Available Models')}
              description={t(
                'Send the model id exactly as written, including the vendor prefix.'
              )}
            >
              <ModelList />
            </DocsSection>

            <DocsSection
              id='tools'
              index='06'
              icon={<Plug />}
              title={t('Connect a Tool')}
              description={t(
                'Pick the guide for the tool you use. Not sure? Start with the first card.'
              )}
            >
              <div className='space-y-4'>
                <div className='flex flex-wrap gap-2'>
                  {TOOL_GUIDE_ANCHORS.map((anchor) => (
                    <a
                      key={anchor.id}
                      href={`#${anchor.id}`}
                      className='rounded-full bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-zinc-300 ring-1 ring-white/10 transition-colors hover:bg-violet-500/10 hover:text-white hover:ring-violet-400/40'
                    >
                      {t(anchor.labelKey)}
                    </a>
                  ))}
                </div>
                <ToolGuides origin={origin} openAiBaseUrl={openAiBaseUrl} />
              </div>
            </DocsSection>

            <DocsSection
              id='troubleshooting'
              index='07'
              icon={<HelpCircle />}
              title={t('Troubleshooting')}
              description={t('The failures people hit most often.')}
            >
              <FaqList />
            </DocsSection>
          </div>
        </div>
      </div>
    </div>
  )
}
