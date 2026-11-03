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
  Boxes,
  CircleCheck,
  Copy,
  HelpCircle,
  KeyRound,
  Plug,
  Route,
  Zap,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { PublicLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'

import { AiSetupCard } from './components/ai-setup-card'
import { CurlExamples } from './components/curl-examples'
import { DocsIndex } from './components/docs-index'
import { DocsSection } from './components/docs-section'
import { EndpointTable, type EndpointRow } from './components/endpoint-table'
import { FaqList } from './components/faq-list'
import { ModelList } from './components/model-list'
import { QuickStart } from './components/quick-start'
import { StepList, type StepItem } from './components/step-list'
import { ToolGuides } from './components/tool-guides'
import { CodeBlock } from './components/code-block'
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

export function Docs() {
  const { t } = useTranslation()
  const { serverAddress } = useChatPresets()

  const origin = useMemo(
    () => serverAddress.replace(/\/+$/, ''),
    [serverAddress]
  )
  const openAiBaseUrl = `${origin}/v1`

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
    <PublicLayout>
      <div className='mx-auto max-w-5xl'>
        <header className='space-y-5'>
          <div className='space-y-2'>
            <h1 className='text-3xl font-bold tracking-tight text-balance sm:text-4xl'>
              {t('Integration Guide')}
            </h1>
            <p className='text-muted-foreground max-w-2xl text-sm sm:text-base'>
              {t(
                'Connect any OpenAI- or Anthropic-compatible client to this gateway.'
              )}
            </p>
          </div>

          <div className='ring-foreground/10 bg-muted/30 space-y-2.5 rounded-xl px-4 py-3 ring-1'>
            <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
              <span className='text-muted-foreground w-44 shrink-0 text-xs font-semibold tracking-wide sm:w-64'>
                {t('OpenAI-compatible clients')}
              </span>
              <code className='font-mono text-sm break-all'>
                {openAiBaseUrl}
              </code>
              <CopyButton
                value={openAiBaseUrl}
                className='size-6'
                iconClassName='size-3.5'
              />
            </div>
            <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
              <span className='text-muted-foreground w-44 shrink-0 text-xs font-semibold tracking-wide sm:w-64'>
                {t('Anthropic clients (Claude Code)')}
              </span>
              <code className='font-mono text-sm break-all'>{origin}</code>
              <CopyButton
                value={origin}
                className='size-6'
                iconClassName='size-3.5'
              />
            </div>
            <p className='text-muted-foreground text-xs'>
              {t(
                'OpenAI-compatible clients use the /v1 address. Anthropic clients such as Claude Code append /v1/messages themselves, so they take the origin only.'
              )}
            </p>
          </div>

          <AiSetupCard origin={origin} />
        </header>

        <div className='mt-10 grid gap-10 lg:grid-cols-[11rem_1fr] lg:gap-12'>
          <DocsIndex />

          <div className='min-w-0 space-y-12'>
            <DocsSection
              id='quick-start'
              icon={<Zap />}
              iconTone='primary'
              title={t('Quick Start')}
              description={t(
                'Four steps from zero to a working client. Follow them in order.'
              )}
            >
              <QuickStart />
            </DocsSection>

            <DocsSection
              id='api-key'
              icon={<KeyRound />}
              iconTone='primary'
              title={t('Get an API Key')}
              description={t(
                'An empty balance fails with a quota error, not an authentication error, so keep a positive balance too.'
              )}
            >
              <div className='space-y-4'>
                <StepList steps={apiKeySteps} />
                <div className='flex flex-wrap gap-2'>
                  <Button
                    render={
                      <Link to='/keys' target='_blank' rel='noopener noreferrer' />
                    }
                  >
                    {t('API Keys')}
                  </Button>
                  <Button
                    variant='outline'
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
              icon={<Route />}
              iconTone='info'
              title={t('API Endpoints')}
              description={t(
                'All four routes take the same token. Paths are relative to the base URL above.'
              )}
            >
              <div className='space-y-4'>
                <EndpointTable rows={endpointRows} />
                <p className='text-muted-foreground flex items-center gap-2 text-xs'>
                  <Copy className='size-3.5 shrink-0' aria-hidden='true' />
                  {t(
                    'Both headers carry the same token. The Anthropic route also requires an anthropic-version header.'
                  )}
                </p>
              </div>
            </DocsSection>

            <DocsSection
              id='verify'
              icon={<CircleCheck />}
              iconTone='success'
              title={t('Verify the Connection')}
              description={t(
                'Copy a snippet, replace the key, and run it. A JSON reply means the base URL and the token are correct.'
              )}
            >
              <div className='space-y-4'>
                <CurlExamples baseUrl={openAiBaseUrl} />
                <div>
                  <h3 className='text-sm font-semibold'>
                    {t('Successful response')}
                  </h3>
                  <p className='text-muted-foreground mt-1 mb-2 text-xs'>
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
              icon={<Boxes />}
              iconTone='chart-2'
              title={t('Available Models')}
              description={t(
                'Send the model id exactly as written, including the vendor prefix.'
              )}
            >
              <ModelList />
            </DocsSection>

            <DocsSection
              id='tools'
              icon={<Plug />}
              iconTone='success'
              title={t('Connect a Tool')}
              description={t(
                'Start with CC Switch: it configures the other agents for you. The manual setups are listed after it.'
              )}
            >
              <div className='space-y-4'>
                <div className='flex flex-wrap gap-2'>
                  {TOOL_GUIDE_ANCHORS.map((anchor) => (
                    <a
                      key={anchor.id}
                      href={`#${anchor.id}`}
                      className='ring-foreground/10 hover:bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors'
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
              icon={<HelpCircle />}
              iconTone='warning'
              title={t('Troubleshooting')}
              description={t('The failures people hit most often.')}
            >
              <FaqList />
            </DocsSection>
          </div>
        </div>
      </div>
    </PublicLayout>
  )
}
