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
import { beforeAll, describe, expect, it, vi } from 'vitest'
import i18next from 'i18next'

// The locale JSON files wrap their flat key maps in a `translation`
// namespace; ensureLocale must unwrap it before registering the bundle
// (registering the wrapper hides every key and the UI falls back to English).
vi.mock('./locales/zh.json', () => ({
  default: { translation: { 'Unified API Gateway for': '统一 API 网关，面向' } },
}))
vi.mock('./locales/fr.json', () => ({
  default: { translation: { 'Unified API Gateway for': 'Passerelle API unifiée' } },
}))
vi.mock('./locales/ja.json', () => ({ default: { translation: {} } }))
vi.mock('./locales/ru.json', () => ({ default: { translation: {} } }))
vi.mock('./locales/vi.json', () => ({ default: { translation: {} } }))
vi.mock('./locales/zh-TW.json', () => ({ default: { translation: {} } }))
vi.mock('./locales/en.json', () => ({ default: { translation: {} } }))

beforeAll(async () => {
  localStorage.removeItem('i18nextLng')
  await import('./config')
})

describe('lazy locale loading', () => {
  it('registers the loaded namespace so translated keys render', async () => {
    const { ensureLocale } = await import('./config')
    await ensureLocale('zhCN')
    await i18next.changeLanguage('zhCN')
    expect(i18next.t('Unified API Gateway for')).toBe('统一 API 网关，面向')
  })

  it('loads a bundle before switching so the switch renders translated text', async () => {
    const { changeAppLanguage } = await import('./config')
    await changeAppLanguage('fr')
    expect(i18next.t('Unified API Gateway for')).toBe('Passerelle API unifiée')
  })

  it('resolves unsupported language codes without throwing', async () => {
    const { ensureLocale } = await import('./config')
    await expect(ensureLocale('xx')).resolves.toBeUndefined()
  })
})
