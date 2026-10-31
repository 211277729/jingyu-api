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
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import { convertDetectedLanguage } from './languages'

// English is bundled with the main chunk so the fallback language is always
// available synchronously; every other locale is code-split and fetched on
// demand. This keeps the entry bundle small — the lazy locales together
// weigh several megabytes raw, and any visitor uses only one of them.
// fr/ru/ja/vi are intentionally not registered: their JSON files stay in
// locales/ for upstream merges but are never bundled or fetched.
import en from './locales/en.json'

export const lazyLocaleModules = {
  zhCN: () => import('./locales/zh.json'),
  zhTW: () => import('./locales/zh-TW.json'),
} as const

type LazyLocaleCode = keyof typeof lazyLocaleModules

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en },
    fallbackLng: 'en',
    supportedLngs: ['en', 'zhCN', 'zhTW'],
    load: 'currentOnly',
    nsSeparator: false, // Allow literal colons in keys (e.g., URLs, labels)
    partialBundledLanguages: true,
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      // Browsers report `zh-CN`/`zh-TW`/`zh`; map them onto our `zhCN`/`zhTW`
      // codes (non-Chinese codes pass through for normal supportedLngs matching).
      convertDetectedLanguage,
    },
  })

// Kick off the fetch for the detected locale before the first render so the
// lazy locale chunk arrives while the browser is still parsing other chunks.
export function preloadLocale(language: string | undefined): void {
  const code = language as LazyLocaleCode | undefined
  if (code && code in lazyLocaleModules) void lazyLocaleModules[code]()
}

// Load a lazy locale bundle into i18next. Concurrent calls for the same locale
// share one in-flight import. The returned promise settles once the bundle is
// registered, so `i18n.changeLanguage` afterwards is synchronous-safe.
const loadedLocales = new Map<LazyLocaleCode, Promise<unknown>>()

export function ensureLocale(language: string): Promise<void> {
  const code = language as LazyLocaleCode
  const loader = lazyLocaleModules[code]
  if (!loader) return Promise.resolve()

  let pending = loadedLocales.get(code)
  if (!pending) {
    pending = loader()
      .then((module) => {
        // The locale JSON wraps its content in a `translation` namespace;
        // addResourceBundle expects the namespace payload itself.
        const bundle = (module.default as { translation: unknown }).translation
        if (!bundle || typeof bundle !== 'object') {
          throw new Error(`locale ${code} has no translation namespace`)
        }
        i18n.addResourceBundle(code, 'translation', bundle, true, true)
      })
      .catch((error) => {
        // Drop the memoized promise so a later call can retry the import;
        // react-i18next meanwhile falls back to English.
        loadedLocales.delete(code)
        throw error
      })
    loadedLocales.set(code, pending)
  }
  return pending.then(() => undefined)
}

i18n.on('languageChanged', (language) => {
  if (language) void ensureLocale(language)
})

// Load the target bundle first, then switch. React keeps rendering the
// previous language while the new one streams in, so the UI never shows raw
// keys mid-switch.
export async function changeAppLanguage(language: string): Promise<void> {
  await ensureLocale(language)
  await i18n.changeLanguage(language)
}

export default i18n
