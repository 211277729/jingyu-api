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

import { NAV_CATEGORIES, NAV_SITE_COUNT } from '../constants'

describe('AI navigation data', () => {
  it('keeps every category id and label key unique', () => {
    const ids = NAV_CATEGORIES.map((category) => category.id)
    const labels = NAV_CATEGORIES.map((category) => category.labelKey)

    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('keeps every category id usable as a DOM anchor', () => {
    for (const category of NAV_CATEGORIES) {
      expect(category.id).toMatch(/^[a-z][a-z0-9-]*$/)
      expect(category.sites.length).toBeGreaterThan(0)
    }
  })

  it('lists sites whose target is an absolute https URL', () => {
    for (const category of NAV_CATEGORIES) {
      for (const site of category.sites) {
        const url = new URL(site.url)

        expect(url.protocol).toBe('https:')
        expect(site.name.trim()).not.toBe('')
      }
    }
  })

  it('lists every site once', () => {
    const urls = NAV_CATEGORIES.flatMap((category) =>
      category.sites.map((site) => site.url)
    )

    expect(new Set(urls).size).toBe(urls.length)
    expect(NAV_SITE_COUNT).toBe(urls.length)
  })

  it('does not repeat a curated site when the directory lists it too', () => {
    const chat = NAV_CATEGORIES.find((category) => category.id === 'chat')

    const chatgpt = chat?.sites.filter(
      (site) => site.url === 'https://chatgpt.com'
    )

    expect(chatgpt).toHaveLength(1)
  })

  it('renders curated entries before the generated directory', () => {
    const chat = NAV_CATEGORIES.find((category) => category.id === 'chat')

    expect(chat?.sites[0]?.name).toBe('ChatGPT')
    expect(chat?.sites.length).toBeGreaterThan(8)
  })

  it('covers the generated directory beyond the curated picks', () => {
    expect(NAV_CATEGORIES.length).toBeGreaterThanOrEqual(16)
    expect(NAV_SITE_COUNT).toBeGreaterThan(300)
  })
})
