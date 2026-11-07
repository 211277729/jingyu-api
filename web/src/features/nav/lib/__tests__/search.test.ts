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

import type { NavCategory } from '../../types'
import { hitAnchorId, searchDirectory } from '../search'

const categories: NavCategory[] = [
  {
    id: 'chat',
    labelKey: 'Chat Assistants',
    sites: [
      { name: 'ChatGPT', url: 'https://chatgpt.com' },
      { name: 'Claude', url: 'https://claude.ai' },
    ],
  },
  {
    id: 'coding',
    labelKey: 'Coding',
    sites: [
      { name: 'GitHub Copilot', url: 'https://github.com/features/copilot' },
    ],
  },
]

const translate = (key: string) => key

describe('directory search', () => {
  it('returns nothing for a blank query', () => {
    expect(searchDirectory(categories, '   ', translate)).toEqual([])
  })

  it('returns nothing when no name, host or category matches', () => {
    expect(searchDirectory(categories, 'midjourney', translate)).toEqual([])
  })

  it('ranks a matching category above the sites inside it', () => {
    const hits = searchDirectory(categories, 'coding', translate)

    expect(hits[0]).toMatchObject({ kind: 'category', categoryId: 'coding' })
  })

  it('finds a site by an infix of its name', () => {
    const hits = searchDirectory(categories, 'clau', translate)

    expect(hits[0]).toMatchObject({
      kind: 'site',
      site: { name: 'Claude' },
      categoryLabelKey: 'Chat Assistants',
    })
  })

  it('finds a site by its hostname', () => {
    const hits = searchDirectory(categories, 'chatgpt.com', translate)

    expect(hits[0]).toMatchObject({ kind: 'site', site: { name: 'ChatGPT' } })
  })

  it('finds a site when the query only matches characters in order', () => {
    const hits = searchDirectory(categories, 'gitcop', translate)

    expect(
      hits.map((hit) => (hit.kind === 'site' ? hit.site.name : ''))
    ).toEqual(['GitHub Copilot'])
  })

  it('anchors a category hit at its section and a site hit at its card', () => {
    const [categoryHit] = searchDirectory(categories, 'coding', translate)
    const [siteHit] = searchDirectory(categories, 'claude', translate)

    expect(hitAnchorId(categoryHit)).toBe('nav-category-coding')
    expect(hitAnchorId(siteHit)).toBe('nav-site-claude-ai')
  })
})
