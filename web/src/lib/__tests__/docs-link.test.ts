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

import { BUILT_IN_DOCS_PATH, resolveDocsTarget } from '../docs-link'

describe('resolveDocsTarget', () => {
  it('keeps an absolute HTTPS URL external', () => {
    expect(resolveDocsTarget('https://docs.example.com')).toEqual({
      href: 'https://docs.example.com',
      external: true,
    })
  })

  it('keeps an absolute HTTP URL external', () => {
    expect(resolveDocsTarget('http://docs.internal')).toEqual({
      href: 'http://docs.internal',
      external: true,
    })
  })

  it('routes a relative path in-site', () => {
    expect(resolveDocsTarget('/guide')).toEqual({
      href: '/guide',
      external: false,
    })
  })

  it('falls back to the built-in guide when the setting is empty', () => {
    expect(resolveDocsTarget('')).toEqual({
      href: BUILT_IN_DOCS_PATH,
      external: false,
    })
  })

  it('falls back to the built-in guide when the setting is absent', () => {
    expect(resolveDocsTarget(undefined)).toEqual({
      href: BUILT_IN_DOCS_PATH,
      external: false,
    })
  })

  it('ignores surrounding whitespace in a configured URL', () => {
    expect(resolveDocsTarget('  https://docs.example.com  ')).toEqual({
      href: 'https://docs.example.com',
      external: true,
    })
  })

  it('treats a whitespace-only setting as unset', () => {
    expect(resolveDocsTarget('   ')).toEqual({
      href: BUILT_IN_DOCS_PATH,
      external: false,
    })
  })

  it('treats the legacy upstream docs host as unset', () => {
    for (const value of [
      'https://docs.newapi.pro',
      'https://docs.newapi.pro/installation/',
    ]) {
      expect(resolveDocsTarget(value)).toEqual({
        href: BUILT_IN_DOCS_PATH,
        external: false,
      })
    }
  })
})
