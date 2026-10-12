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
import { isHttpUrl } from './content-format'

/** The integration guide this deployment ships, used when nothing is set. */
export const BUILT_IN_DOCS_PATH = '/docs'

export type DocsTarget = {
  href: string
  /** Whether the target leaves the app and needs `target='_blank'`. */
  external: boolean
}

/**
 * Resolve the administrator's `general_setting.docs_link` into a link target.
 *
 * An absolute HTTP(S) URL opens the configured site in a new tab; any other
 * value is a route on this deployment; an empty value falls back to the guide
 * bundled at {@link BUILT_IN_DOCS_PATH}.
 *
 * Shared by the header navigation and the home page hero so both agree on the
 * same value. Resolving it separately in each place is what let a cleared
 * setting send the header to the built-in guide while the hero still opened a
 * different site.
 */
export function resolveDocsTarget(configured: string | undefined): DocsTarget {
  const value = configured?.trim()
  if (value && isHttpUrl(value)) {
    return { href: value, external: true }
  }
  return { href: value || BUILT_IN_DOCS_PATH, external: false }
}
