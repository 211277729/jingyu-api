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

import { toResourceItem } from '../api'
import type { ResourceApiItem } from '../types'

const apiRow: ResourceApiItem = {
  id: 1,
  slug: 'skill-reviewer',
  name: 'Code Reviewer',
  kind: 'skill',
  icon_name: '',
  vendor: 'Official',
  tags: ['review'],
  summary: { zh: '代码评审', en: 'Code review' },
  description: { zh: '', en: '' },
  highlights: { zh: [], en: [] },
  content: '## 用法\n\n- 贴一段 diff',
  install_command: '',
  download_url: '',
  repo_url: 'https://github.com/example/skill',
  sort_order: 10,
}

describe('toResourceItem', () => {
  it('keeps the markdown body so the detail page can render it', () => {
    expect(toResourceItem(apiRow).content).toBe('## 用法\n\n- 贴一段 diff')
  })

  it('turns an empty body into undefined so the section stays hidden', () => {
    // 老数据 / 未填正文时列表接口给的是空串，页面不该出现空白的 Content 区块
    expect(toResourceItem({ ...apiRow, content: '' }).content).toBeUndefined()
  })
})
