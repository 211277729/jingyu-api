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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { MCP_CLIENTS, type McpClientId } from '../mcp'
import type { McpServerSpec } from '../types'
import { SnippetBlock } from './snippet-block'

/**
 * MCP 详情页的接入区：同一个服务器按客户端生成各自的配置片段，
 * 客户装的是 Claude Code 还是 Cursor / VS Code 都有对应示例。
 */
export function McpInstall({
  spec,
  className,
}: {
  spec: McpServerSpec
  className?: string
}) {
  const { t } = useTranslation()
  const [activeId, setActiveId] = useState<McpClientId>(MCP_CLIENTS[0].id)
  const active =
    MCP_CLIENTS.find((client) => client.id === activeId) ?? MCP_CLIENTS[0]
  const hasCredentials = Object.keys(spec.env ?? {}).length > 0

  return (
    <section className={cn('mt-4', className)}>
      <h2 className='text-sm font-semibold tracking-wide'>
        {t('Add to your AI tool')}
      </h2>
      <p className='text-muted-foreground mt-1.5 text-xs leading-relaxed'>
        {t(
          'Pick the tool you already use. Other clients that read mcpServers — Claude Desktop, Cherry Studio, Windsurf and more — can paste the same JSON.'
        )}
      </p>

      <div className='mt-3 flex flex-wrap gap-1.5'>
        {MCP_CLIENTS.map((client) => (
          <button
            key={client.id}
            type='button'
            onClick={() => setActiveId(client.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs transition-colors',
              activeId === client.id
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground border-border/60'
            )}
          >
            {client.label}
          </button>
        ))}
      </div>

      <SnippetBlock
        className='mt-3'
        label={active.target}
        code={active.build(spec)}
      />

      {hasCredentials ? (
        <p className='text-muted-foreground mt-2 text-xs leading-relaxed'>
          {t(
            'Replace the placeholder credential with your own key before starting the server.'
          )}
        </p>
      ) : null}
    </section>
  )
}
