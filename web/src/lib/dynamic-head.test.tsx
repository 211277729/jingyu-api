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
import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useDynamicHead } from './dynamic-head'

function HookProbe(props: {
  canonicalPath: string | null
  jsonLd: Record<string, unknown> | null
  noindex: boolean
}) {
  useDynamicHead(props)
  return null
}

describe('useDynamicHead', () => {
  afterEach(() => {
    document.head.innerHTML = ''
  })

  it('noindex=true 时注入 robots noindex（软 404）', () => {
    render(<HookProbe canonicalPath={null} jsonLd={null} noindex={true} />)
    const el = document.getElementById('seo-dynamic-noindex')
    expect(el).not.toBeNull()
    expect(el?.getAttribute('name')).toBe('robots')
    expect(el?.getAttribute('content')).toBe('noindex, follow')
    // 无 canonical / JSON-LD
    expect(document.getElementById('seo-dynamic-canonical')).toBeNull()
    expect(document.getElementById('seo-dynamic-jsonld')).toBeNull()
  })

  it('noindex=false 时移除 noindex，写 canonical 与 JSON-LD', () => {
    render(
      <HookProbe
        canonicalPath='https://jingyuai.xiaoyuji.cn/pricing/gpt-6-luna'
        jsonLd={{ '@type': 'Product' }}
        noindex={false}
      />
    )
    expect(document.getElementById('seo-dynamic-noindex')).toBeNull()
    const canonical = document.getElementById('seo-dynamic-canonical')
    expect(canonical?.getAttribute('rel')).toBe('canonical')
    expect(canonical?.getAttribute('href')).toBe(
      'https://jingyuai.xiaoyuji.cn/pricing/gpt-6-luna'
    )
    const jsonLd = document.getElementById('seo-dynamic-jsonld')
    expect(jsonLd?.getAttribute('type')).toBe('application/ld+json')
    expect(jsonLd?.textContent).toContain('Product')
  })

  it('spec 变化时更新节点，卸载时清理', () => {
    const { rerender, unmount } = render(
      <HookProbe canonicalPath={null} jsonLd={null} noindex={true} />
    )
    expect(document.getElementById('seo-dynamic-noindex')).not.toBeNull()

    rerender(
      <HookProbe
        canonicalPath='https://jingyuai.xiaoyuji.cn/pricing/x'
        jsonLd={{ a: 1 }}
        noindex={false}
      />
    )
    expect(document.getElementById('seo-dynamic-noindex')).toBeNull()
    expect(
      document.getElementById('seo-dynamic-canonical')?.getAttribute('href')
    ).toBe('https://jingyuai.xiaoyuji.cn/pricing/x')

    unmount()
    expect(document.getElementById('seo-dynamic-canonical')).toBeNull()
    expect(document.getElementById('seo-dynamic-jsonld')).toBeNull()
    expect(document.getElementById('seo-dynamic-noindex')).toBeNull()
  })
})
