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
import type { McpServerSpec } from './types'

export type McpClientId = 'claude' | 'codex' | 'gemini' | 'cursor' | 'vscode'

export type McpClient = {
  id: McpClientId
  /** chip 上的产品名，品牌词不翻译，直接展示 */
  label: string
  /** 码块头部展示的终端命令或配置文件路径 */
  target: string
  build: (spec: McpServerSpec) => string
}

/** TOML 基础字符串与 JSON 字符串转义规则一致，可直接复用 */
const tomlString = (value: string) => JSON.stringify(value)

const tomlArray = (values: string[]) => `[${values.map(tomlString).join(', ')}]`

/** Claude Code：一条命令写入用户级配置 */
function buildClaude(spec: McpServerSpec) {
  const envFlags = Object.entries(spec.env ?? {}).map(
    ([key, value]) => `-e ${key}=${value}`
  )
  const command = [spec.command, ...spec.args].join(' ')
  return `claude mcp add ${[spec.name, ...envFlags, '--', command].join(' ')}`
}

/** Codex CLI：`~/.codex/config.toml` 的 mcp_servers 表 */
function buildCodex(spec: McpServerSpec) {
  const lines = [
    `[mcp_servers.${spec.name}]`,
    `command = ${tomlString(spec.command)}`,
    `args = ${tomlArray(spec.args)}`,
  ]
  const env = Object.entries(spec.env ?? {})
  if (env.length > 0) {
    const pairs = env
      .map(([key, value]) => `${tomlString(key)} = ${tomlString(value)}`)
      .join(', ')
    lines.push(`env = { ${pairs} }`)
  }
  return lines.join('\n')
}

/** 读取 mcpServers 的客户端：Cursor / Windsurf / Cline / Gemini / Claude Desktop */
function buildMcpServersJson(spec: McpServerSpec) {
  const env = Object.entries(spec.env ?? {})
  const server = {
    command: spec.command,
    args: spec.args,
    ...(env.length > 0 ? { env: spec.env } : {}),
  }
  return JSON.stringify({ mcpServers: { [spec.name]: server } }, null, 2)
}

/** VS Code（Copilot agent 模式）：顶层键是 servers，且需要标注 stdio */
function buildVscodeJson(spec: McpServerSpec) {
  const env = Object.entries(spec.env ?? {})
  const server = {
    type: 'stdio',
    command: spec.command,
    args: spec.args,
    ...(env.length > 0 ? { env: spec.env } : {}),
  }
  return JSON.stringify({ servers: { [spec.name]: server } }, null, 2)
}

/**
 * 详情页的可选客户端顺序：先放命令行 Agent，再放编辑器与通用 JSON。
 * 新增客户端时补一项即可，数据文件无需改动。
 */
export const MCP_CLIENTS: McpClient[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    target: 'terminal',
    build: buildClaude,
  },
  {
    id: 'codex',
    label: 'Codex CLI',
    target: '~/.codex/config.toml',
    build: buildCodex,
  },
  {
    id: 'gemini',
    label: 'Gemini CLI',
    target: '~/.gemini/settings.json',
    build: buildMcpServersJson,
  },
  {
    id: 'cursor',
    label: 'Cursor / Windsurf / Cline',
    target: '.cursor/mcp.json',
    build: buildMcpServersJson,
  },
  {
    id: 'vscode',
    label: 'VS Code',
    target: '.vscode/mcp.json',
    build: buildVscodeJson,
  },
]

/** 卡片上的快捷复制：沿用第一个客户端（Claude Code）的写法 */
export function buildDefaultMcpSnippet(spec: McpServerSpec) {
  return (MCP_CLIENTS[0] ?? { build: buildMcpServersJson }).build(spec)
}
