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
/**
 * LobeHub Icon Loader
 * Dynamically load and render icons from @lobehub/icons
 *
 * Supports:
 * - Basic: "OpenAI", "OpenAI.Color"
 * - Chained properties: "OpenAI.Avatar.type={'platform'}"
 * - Size parameter: getLobeIcon("OpenAI", 20)
 *
 * Public API; the catalog state and rendering live in lobe-icon-internal /
 * lobe-icon-view so consumers of `getLobeIcon` need no changes.
 */
import { useSyncExternalStore, type ReactNode } from 'react'

import { LobeIconView } from './lobe-icon-view'
import {
  catalogNames,
  getIconCatalogSnapshot,
  loadLobeIconCatalog,
  subscribeCatalog,
} from './lobe-icon-internal'

export { loadLobeIconCatalog } from './lobe-icon-internal'

const CUSTOM_NAMES = ['SGLang', 'Sub2API', 'Wan', 'WorkBuddy'] as const

function useIconCatalogSubscription() {
  useSyncExternalStore(subscribeCatalog, getIconCatalogSnapshot, () => null)
}

/**
 * Get LobeHub icon component by name
 * @param iconName - Icon name/description (e.g., "OpenAI", "OpenAI.Color", "Claude.Avatar")
 * @param size - Icon size (default: 20)
 * @returns Icon component or fallback
 *
 * @example
 * getLobeIcon("OpenAI", 24)
 * getLobeIcon("OpenAI.Color", 20)
 * getLobeIcon("Claude.Avatar.type={'platform'}", 32)
 */
export function getLobeIcon(
  iconName: string | undefined | null,
  size: number = 20
): ReactNode {
  return <LobeIconView iconName={iconName} size={size} />
}

// The selector uses the same installed icon registry as the renderer.
export function getLobeIconNames(): string[] {
  if (!getIconCatalogSnapshot()) {
    void loadLobeIconCatalog()
    return [...CUSTOM_NAMES]
  }
  return catalogNames()
}

/**
 * React hook for the installed icon names. Re-renders once the catalog
 * finishes loading, so pickers subscribed to it fill in automatically.
 */
export function useLobeIconNames(): string[] {
  // Subscribe so the caller re-renders once the catalog resolves.
  useIconCatalogSubscription()
  return catalogNames()
}
