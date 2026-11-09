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
import { useEffect } from 'react'

// 组件级 head 管理：数据在组件内才知道「存在与否」的详情页（模型详情、
// 资源详情）用不了路由 head 的动态内容——路由层拿不到数据。这里直接操作
// document.head：
// - canonical / JSON-LD：存在且属于本 hook 管理的节点会被替换或移除
// - noindex：软 404（数据不存在）时注入，正常时清掉
// HeadContent 只渲染路由 head；路由级静态 head + 组件级动态修正组合使用。

export interface DynamicHeadSpec {
  // 存在时写入 canonical；null 时移除
  canonicalPath: string | null
  // 存在时写入 JSON-LD；null 时移除
  jsonLd: Record<string, unknown> | null
  // true 时注入 robots noindex（软 404）
  noindex: boolean
}

const CANONICAL_ID = 'seo-dynamic-canonical'
const JSONLD_ID = 'seo-dynamic-jsonld'
const NOINDEX_ID = 'seo-dynamic-noindex'

function upsertLink(id: string, attrs: Record<string, string>) {
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('link')
    el.id = id
    document.head.appendChild(el)
  }
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, value)
  }
}

function upsertMeta(id: string, attrs: Record<string, string>) {
  let el = document.getElementById(id)
  if (!el) {
    el = document.createElement('meta')
    el.id = id
    document.head.appendChild(el)
  }
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, value)
  }
}

function removeById(id: string) {
  document.getElementById(id)?.remove()
}

// useDynamicHead 每次渲染对比 spec 后写 head；组件卸载时清掉动态节点，
// 避免路由切换后残留上一个详情页的数据。
export function useDynamicHead(spec: DynamicHeadSpec) {
  const { canonicalPath, jsonLd, noindex } = spec

  useEffect(() => {
    if (canonicalPath) {
      upsertLink(CANONICAL_ID, {
        rel: 'canonical',
        href: canonicalPath,
      })
    } else {
      removeById(CANONICAL_ID)
    }

    const jsonLdEl = document.getElementById(JSONLD_ID)
    if (jsonLd) {
      const serialized = JSON.stringify(jsonLd)
      if (jsonLdEl) {
        jsonLdEl.textContent = serialized
      } else {
        const script = document.createElement('script')
        script.id = JSONLD_ID
        script.type = 'application/ld+json'
        script.textContent = serialized
        document.head.appendChild(script)
      }
    } else {
      removeById(JSONLD_ID)
    }

    if (noindex) {
      upsertMeta(NOINDEX_ID, { name: 'robots', content: 'noindex, follow' })
    } else {
      removeById(NOINDEX_ID)
    }

    return () => {
      removeById(CANONICAL_ID)
      removeById(JSONLD_ID)
      removeById(NOINDEX_ID)
    }
  }, [canonicalPath, noindex, jsonLd])
}
