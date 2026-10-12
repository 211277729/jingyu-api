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
import { Boxes, HelpCircle, KeyRound, Plug, Route } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { PublicLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'

import { CurlExamples } from './components/curl-examples'
import { DocsIndex } from './components/docs-index'
import { DocsSection } from './components/docs-section'
import { EndpointTable, type EndpointRow } from './components/endpoint-table'
import { FaqList } from './components/faq-list'
import { ModelList } from './components/model-list'
import { ToolGuides } from './components/tool-guides'
import { DOCS_ENDPOINTS } from './constants'

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

          <div className='ring-foreground/10 bg-muted/30 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-4 py-3 ring-1'>
            <span className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
              {t('Base URL')}
            </span>
            <code className='font-mono text-sm break-all'>{openAiBaseUrl}</code>
            <CopyButton
              value={openAiBaseUrl}
              className='size-6'
              iconClassName='size-3.5'
            />
            <p className='text-muted-foreground w-full text-xs'>
              {t(
                'OpenAI-compatible clients use this address. Anthropic clients such as Claude Code use the origin without the /v1 suffix.'
              )}
            </p>
          </div>
        </header>

        <div className='mt-10 grid gap-10 lg:grid-cols-[11rem_1fr] lg:gap-12'>
          <DocsIndex />

          <div className='min-w-0 space-y-12'>
            <DocsSection
              id='api-key'
              icon={<KeyRound />}
              iconTone='primary'
              title={t('Get an API Key')}
              description={t(
                'Create a token under API Keys and keep a positive balance. An empty balance fails with a quota error, not an authentication error.'
              )}
            >
              <div className='flex flex-wrap gap-2'>
                <Button render={<Link to='/keys' />}>{t('API Keys')}</Button>
                <Button variant='outline' render={<Link to='/wallet' />}>
                  {t('Wallet')}
                </Button>
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
                <p className='text-muted-foreground text-xs'>
                  {t(
                    'Both headers carry the same token. The Anthropic route also requires an anthropic-version header.'
                  )}
                </p>
                <CurlExamples baseUrl={openAiBaseUrl} />
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
              <ToolGuides origin={origin} openAiBaseUrl={openAiBaseUrl} />
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
