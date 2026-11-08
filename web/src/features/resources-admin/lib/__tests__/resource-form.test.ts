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

import type { ResourceAdminItem, ResourceFormValues } from '../../types'
import {
  buildResourcePayload,
  parseEnvLines,
  rowToPayload,
  splitLines,
  splitTags,
  toResourceFormValues,
} from '../resource-form'

const baseValues: ResourceFormValues = {
  slug: 'fetch',
  name: 'Fetch',
  kind: 'mcp',
  vendor: 'Official',
  icon_name: 'globe',
  tags: ' web, 网页 ,web',
  summary_zh: '抓网页',
  summary_en: 'Fetch pages',
  description_zh: '',
  description_en: '',
  highlights_zh: '第一行\n\n第二行',
  highlights_en: 'first\nsecond',
  mcp_name: '',
  mcp_command: 'uvx',
  mcp_args: 'mcp-server-fetch\n',
  mcp_env: 'TOKEN=abc\nbroken-line\n=empty',
  content: '  ## 用法\n\n- 第一步  ',
  install_command: 'uvx mcp-server-fetch',
  download_url: '',
  repo_url: 'https://example.com/repo',
  sort_order: 3,
  enabled: true,
}

const adminRow: ResourceAdminItem = {
  id: 7,
  slug: 'fetch',
  name: 'Fetch',
  kind: 'mcp',
  icon_name: 'globe',
  vendor: 'Official',
  tags: ['web'],
  summary: { zh: '抓网页', en: 'Fetch pages' },
  description: { zh: '', en: '' },
  highlights: { zh: ['第一行'], en: ['first'] },
  mcp: { name: 'fetch', command: 'uvx', args: ['mcp-server-fetch'] },
  content: '## 用法\n\n- 第一步',
  install_command: 'uvx mcp-server-fetch',
  download_url: '',
  repo_url: 'https://example.com/repo',
  sort_order: 3,
  enabled: false,
  created_at: 1700000000,
  updated_at: 1700000100,
}

describe('splitTags', () => {
  it('splits on half-width and full-width commas, trims and dedupes', () => {
    expect(splitTags(' web, 网页 ，web,')).toEqual(['web', '网页'])
  })
})

describe('splitLines', () => {
  it('drops blank lines from textarea input', () => {
    expect(splitLines('a\n\n b \n')).toEqual(['a', 'b'])
  })
})

describe('parseEnvLines', () => {
  it('keeps only well-formed KEY=VALUE lines', () => {
    expect(parseEnvLines('TOKEN=abc\nbroken\n=empty')).toEqual({
      TOKEN: 'abc',
    })
  })

  it('returns undefined when nothing parses', () => {
    expect(parseEnvLines('')).toBeUndefined()
  })
})

describe('buildResourcePayload', () => {
  it('splits text fields back into arrays and keeps mcp for mcp kind', () => {
    const payload = buildResourcePayload(baseValues)
    expect(payload.tags).toEqual(['web', '网页'])
    expect(payload.highlights_zh).toEqual(['第一行', '第二行'])
    expect(payload.mcp).toEqual({
      name: 'fetch',
      command: 'uvx',
      args: ['mcp-server-fetch'],
      env: { TOKEN: 'abc' },
    })
    expect(payload.id).toBeUndefined()
  })

  it('drops mcp config for non-mcp kinds and trims urls', () => {
    const payload = buildResourcePayload({
      ...baseValues,
      kind: 'skill',
      download_url: '  https://example.com/a.zip  ',
    })
    expect(payload.mcp).toBeUndefined()
    expect(payload.download_url).toBe('https://example.com/a.zip')
  })

  it('keeps the markdown body as one trimmed string', () => {
    const payload = buildResourcePayload({ ...baseValues, kind: 'skill' })
    // 正文只能去首尾空白，内部换行必须原样保留，否则 Markdown 排版会散
    expect(payload.content).toBe('## 用法\n\n- 第一步')
  })

  it('carries the id through for updates', () => {
    expect(buildResourcePayload(baseValues, 12).id).toBe(12)
  })
})

describe('toResourceFormValues / rowToPayload', () => {
  it('round-trips a row without losing fields', () => {
    const values = toResourceFormValues(adminRow)
    expect(values.mcp_env).toBe('')
    expect(values.highlights_en).toBe('first')
    expect(values.content).toBe('## 用法\n\n- 第一步')

    const payload = rowToPayload(adminRow, { enabled: true })
    expect(payload.enabled).toBe(true)
    expect(payload.id).toBe(7)
    expect(payload.summary_en).toBe('Fetch pages')
    expect(payload.mcp).toEqual(adminRow.mcp)
    expect(payload.content).toBe('## 用法\n\n- 第一步')
  })

  it('keeps disabled rows disabled unless overridden', () => {
    expect(rowToPayload(adminRow).enabled).toBe(false)
    expect(rowToPayload(adminRow).sort_order).toBe(3)
  })
})
