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
import { describe, expect, it } from 'vitest'

import { MCP_CLIENTS, buildDefaultMcpSnippet } from '../mcp'
import type { McpServerSpec } from '../types'

const fetchSpec: McpServerSpec = {
  name: 'fetch',
  command: 'uvx',
  args: ['mcp-server-fetch'],
}

const githubSpec: McpServerSpec = {
  name: 'github',
  command: 'docker',
  args: ['run', '-i', '--rm', 'ghcr.io/github/github-mcp-server'],
  env: { GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_...' },
}

const build = (id: string, spec: McpServerSpec) => {
  const client = MCP_CLIENTS.find((entry) => entry.id === id)
  if (!client) throw new Error(`missing client ${id}`)
  return client.build(spec)
}

describe('MCP client snippets', () => {
  it('renders the Claude Code one-liner', () => {
    expect(build('claude', fetchSpec)).toBe(
      'claude mcp add fetch -- uvx mcp-server-fetch'
    )
  })

  it('passes credentials to Claude Code with -e flags', () => {
    expect(build('claude', githubSpec)).toContain(
      'claude mcp add github -e GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...'
    )
  })

  it('renders an mcp_servers table for Codex CLI', () => {
    expect(build('codex', githubSpec)).toBe(
      [
        '[mcp_servers.github]',
        'command = "docker"',
        'args = ["run", "-i", "--rm", "ghcr.io/github/github-mcp-server"]',
        'env = { "GITHUB_PERSONAL_ACCESS_TOKEN" = "ghp_..." }',
      ].join('\n')
    )
  })

  it('renders mcpServers JSON without env when not needed', () => {
    expect(JSON.parse(build('cursor', fetchSpec))).toEqual({
      mcpServers: {
        fetch: { command: 'uvx', args: ['mcp-server-fetch'] },
      },
    })
  })

  it('renders VS Code servers JSON with an explicit stdio type', () => {
    expect(JSON.parse(build('vscode', fetchSpec))).toEqual({
      servers: {
        fetch: {
          type: 'stdio',
          command: 'uvx',
          args: ['mcp-server-fetch'],
        },
      },
    })
  })

  it('copies the Claude Code snippet by default', () => {
    expect(buildDefaultMcpSnippet(fetchSpec)).toBe(build('claude', fetchSpec))
  })
})
