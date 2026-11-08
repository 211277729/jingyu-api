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
import { cleanup, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useResourcesQuery } from '../api'
import { ResourceDetail } from '../detail'
import type { ResourceItem } from '../types'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  Link: (props: { to: string; children?: React.ReactNode }) => (
    <a href={props.to}>{props.children}</a>
  ),
}))

// 详情页只依赖这一个查询：直接给它喂固定数据，避免真发请求
vi.mock('../api', () => ({
  useResourcesQuery: vi.fn(),
}))

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

const baseItem: ResourceItem = {
  slug: 'skill-reviewer',
  name: 'Code Reviewer',
  kind: 'skill',
  vendor: 'Official',
  tags: ['review'],
  summary: { zh: '代码评审', en: 'Reviews diffs' },
  description: { zh: '', en: 'Reviews a diff before you commit.' },
  highlights: { zh: [], en: [] },
  installCommand: 'npx review',
  repoUrl: 'https://github.com/example/skill',
}

/** 页面上一级区块标题（按 DOM 顺序），用来断言排版顺序 */
function sectionHeadings(): string[] {
  return [...document.querySelectorAll('h2')].map(
    (node) => node.textContent?.trim() ?? ''
  )
}

function renderDetail(item: ResourceItem) {
  vi.mocked(useResourcesQuery).mockReturnValue({
    data: [item],
    isLoading: false,
    isError: false,
    refetch: () => undefined,
  } as unknown as ReturnType<typeof useResourcesQuery>)

  return render(
    <I18nextProvider i18n={i18n}>
      <ResourceDetail slug={item.slug} />
    </I18nextProvider>
  )
}

afterEach(cleanup)

describe('ResourceDetail markdown content', () => {
  it('renders the markdown body as markdown instead of raw text', () => {
    renderDetail({
      ...baseItem,
      content: '## 快速开始\n\n- 第一步\n\n```bash\nnpx review\n```',
    })

    expect(
      screen.getByRole('heading', { name: '快速开始' })
    ).toBeInTheDocument()
    expect(screen.getByText('第一步')).toBeInTheDocument()
    // 原始 Markdown 标记不该原样露出来
    expect(screen.queryByText('## 快速开始')).toBeNull()
  })

  it('hides the section when the resource has no markdown body', () => {
    renderDetail(baseItem)

    expect(screen.queryByRole('heading', { name: 'Content' })).toBeNull()
  })

  it('puts the usage block before the markdown body', () => {
    renderDetail({ ...baseItem, content: '## 快速开始' })

    const headings = sectionHeadings()
    expect(headings.indexOf('Install command')).toBeGreaterThanOrEqual(0)
    expect(headings.indexOf('Install command')).toBeLessThan(
      headings.indexOf('Content')
    )
  })

  it('drops the whole highlights block when a resource has none', () => {
    renderDetail({ ...baseItem, content: '## 快速开始' })
    expect(sectionHeadings()).not.toContain('Highlights')

    cleanup()
    renderDetail({
      ...baseItem,
      highlights: { zh: ['中文亮点'], en: ['English highlight'] },
    })
    expect(
      screen.getByRole('heading', { name: 'Highlights' })
    ).toBeInTheDocument()
  })

  it('shares the back-to-top button with the rest of the site', () => {
    renderDetail(baseItem)

    expect(
      screen.getByRole('button', { name: 'Back to top' })
    ).toBeInTheDocument()
  })
})
