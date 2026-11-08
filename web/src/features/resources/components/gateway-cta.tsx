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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { SnippetBlock } from '@/features/resources/components/snippet-block'
import { cn } from '@/lib/utils'

type SnippetTab = {
  id: string
  labelKey: string
  buildCode: (origin: string) => string
}

const SNIPPET_TABS: SnippetTab[] = [
  {
    id: 'claude',
    labelKey: 'Claude Code & Anthropic clients',
    buildCode: (origin) =>
      [
        `export ANTHROPIC_BASE_URL="${origin}"`,
        `export ANTHROPIC_AUTH_TOKEN="sk-..."`,
        '',
        '# Claude Code 启动前导出即可生效',
      ].join('\n'),
  },
  {
    id: 'openai',
    labelKey: 'OpenAI-compatible clients',
    buildCode: (origin) =>
      [
        `export OPENAI_BASE_URL="${origin}/v1"`,
        `export OPENAI_API_KEY="sk-..."`,
        '',
        '# Cherry Studio / Cline / LobeChat 等客户端',
        '# 在自定义供应商里填同样的地址与密钥',
      ].join('\n'),
  },
  {
    id: 'curl',
    labelKey: 'One-off request',
    buildCode: (origin) =>
      [
        `curl ${origin}/v1/chat/completions \\`,
        `  -H "Authorization: Bearer sk-..." \\`,
        `  -H "Content-Type: application/json" \\`,
        `  -d '{`,
        `    "model": "gpt-4o-mini",`,
        `    "messages": [{"role": "user", "content": "Hello!"}]`,
        `  }'`,
      ].join('\n'),
  },
]

/**
 * 详情页底部的转化块：展示三类客户端的接入片段，
 * key 用占位符呈现，注册入口引导用户去控制台建密钥。
 */
export function GatewayCta() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState(SNIPPET_TABS[0].id)

  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://example.com'
  const snippet =
    SNIPPET_TABS.find((tab) => tab.id === activeTab) ?? SNIPPET_TABS[0]

  return (
    <section className='border-primary/20 from-primary/[0.05] relative overflow-hidden rounded-2xl border bg-gradient-to-b to-transparent p-5 sm:p-6'>
      <div
        aria-hidden
        className='bg-primary/10 pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full blur-3xl'
      />
      <div className='relative'>
        <h3 className='text-base font-semibold sm:text-lg'>
          {t('Run it through this gateway')}
        </h3>
        <p className='text-muted-foreground mt-1.5 text-xs leading-relaxed sm:text-sm'>
          {t(
            'Get an API key from the Console, then replace sk-... in the snippet with your own key.'
          )}
        </p>

        <div className='mt-4 flex flex-wrap gap-1.5'>
          {SNIPPET_TABS.map((tab) => (
            <button
              key={tab.id}
              type='button'
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs transition-colors',
                activeTab === tab.id
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground border-border/60'
              )}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <div className='mt-3'>
          <SnippetBlock
            label={t(snippet.labelKey)}
            code={snippet.buildCode(origin)}
          />
        </div>

        <div className='mt-4'>
          <Button render={<Link to='/dashboard' />}>
            {t('Create an API key')}
          </Button>
        </div>
      </div>
    </section>
  )
}
