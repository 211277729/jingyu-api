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
 * LobeHub icon internals: catalog state, resolver and lazy component loader.
 *
 * The icon catalog (`@lobehub/icons/es/toc`) loads on demand instead of
 * bundling with the entry chunk: it is only needed the first time an icon or
 * the icon picker renders. Until it resolves (or for names missing from the
 * installed catalog) icons render as the initial-letter placeholder.
 */
import {
  lazy,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from 'react'

import sglangLogo from '@/assets/brand-icons/sglang.svg'
import { IconSub2api } from '@/assets/custom/icon-sub2api'
import { IconWan } from '@/assets/custom/icon-wan'

export const CUSTOM_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  SGLang: (props) => (
    <img
      src={sglangLogo}
      alt=''
      aria-hidden='true'
      width={props.size ?? 20}
      height={props.size ?? 20}
      className='object-contain'
    />
  ),
  Sub2API: IconSub2api,
  Wan: IconWan,
}

type ParamFlags =
  | 'hasAvatar'
  | 'hasBrand'
  | 'hasBrandColor'
  | 'hasColor'
  | 'hasCombine'
  | 'hasText'
  | 'hasTextCn'
  | 'hasTextColor'

export type IconCatalogEntry = {
  id: string
  param: Record<ParamFlags, boolean>
}
export type IconCatalog = readonly IconCatalogEntry[]

let catalogPromise: Promise<IconCatalog> | null = null
let catalog: IconCatalog | null = null
const catalogListeners = new Set<() => void>()

function applyCatalog(next: IconCatalog): void {
  catalog = next
  for (const listener of catalogListeners) listener()
  catalogListeners.clear()
}

/** Resolve (and memoize) the installed icon catalog. */
export function loadLobeIconCatalog(): Promise<IconCatalog> {
  if (!catalogPromise) {
    catalogPromise = import('@lobehub/icons/es/toc')
      .then((module) => {
        applyCatalog(module.toc as IconCatalog)
        return catalog as IconCatalog
      })
      .catch(() => {
        // Keep the module usable even if the catalog chunk fails; every icon
        // name then misses the catalog and renders the placeholder.
        applyCatalog([])
        return [] as IconCatalog
      })
  }
  return catalogPromise
}

export function subscribeCatalog(listener: () => void): () => void {
  if (catalog) return () => {}
  catalogListeners.add(listener)
  void loadLobeIconCatalog()
  return () => {
    catalogListeners.delete(listener)
  }
}

export function getIconCatalogSnapshot(): IconCatalog | null {
  return catalog
}

export const ICON_VARIANTS = {
  Avatar: 'hasAvatar',
  Brand: 'hasBrand',
  BrandColor: 'hasBrandColor',
  Color: 'hasColor',
  Combine: 'hasCombine',
  Text: 'hasText',
  TextCn: 'hasTextCn',
  TextColor: 'hasTextColor',
} as const

const LAZY_ICONS = new Map<
  string,
  LazyExoticComponent<ComponentType<Record<string, unknown>>>
>()

export function renderIconFallback(
  name: string,
  size: number | string
): ReactNode {
  return (
    <div
      className='bg-muted text-muted-foreground flex items-center justify-center rounded-full text-xs font-medium'
      style={{ width: size, height: size }}
    >
      {name.charAt(0).toUpperCase() || '?'}
    </div>
  )
}

/**
 * Parse a property value from string to appropriate type
 * @param raw - Raw string value
 * @returns Parsed value (boolean, number, or string)
 */
function parseValue(raw: string | undefined | null): string | number | boolean {
  if (raw == null) return true

  let v = String(raw).trim()

  // Remove curly braces
  if (v.startsWith('{') && v.endsWith('}')) {
    v = v.slice(1, -1).trim()
  }

  // Remove quotes
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1)
  }

  // Boolean
  if (v === 'true') return true
  if (v === 'false') return false

  // Number
  if (/^-?\d+(?:\.\d+)?$/.test(v)) return Number(v)

  // Return as string
  return v
}

function getLazyIcon(cacheKey: string, baseKey: string, variant: string) {
  let IconComponent = LAZY_ICONS.get(cacheKey)
  if (!IconComponent) {
    // Load the selected SVG variant, avoiding the brand index's Avatar/UI dependencies.
    // Rspack applies webpackInclude before normalizing Windows path separators.
    IconComponent = lazy(() =>
      import(
        /* webpackInclude: /[\\/]components[\\/](Mono|Avatar|Brand|BrandColor|Color|Combine|Text|TextCn|TextColor|Simple|Morden)\.js$/ */
        `@lobehub/icons/es/${baseKey}/components/${variant}.js`
      ).catch(() => ({
        default: (props: Record<string, unknown>) =>
          renderIconFallback(
            baseKey,
            typeof props.size === 'number' || typeof props.size === 'string'
              ? props.size
              : 20
          ),
      }))
    )
    LAZY_ICONS.set(cacheKey, IconComponent)
  }
  return IconComponent
}

export type ResolvedIcon =
  | { kind: 'fallback'; name: string }
  | {
      kind: 'custom'
      CustomIcon: ComponentType<{ size?: number }>
    }
  | {
      kind: 'component'
      IconComponent: LazyExoticComponent<ComponentType<Record<string, unknown>>>
      props: Record<string, string | number | boolean>
    }

/**
 * Resolve an icon name against the current catalog state. Catalog pending →
 * the view renders the placeholder; names missing from the installed catalog
 * → fallback.
 */
export function resolveLobeIcon(
  iconName: string | undefined | null,
  toc: IconCatalog | null
): ResolvedIcon {
  const trimmedName = typeof iconName === 'string' ? iconName.trim() : ''
  if (!trimmedName) return { kind: 'fallback', name: '' }

  const segments = trimmedName.split('.')
  const baseKey = segments[0]
  const CustomIcon = CUSTOM_ICONS[baseKey]
  if (CustomIcon) {
    return { kind: 'custom', CustomIcon }
  }
  if (!toc) return { kind: 'fallback', name: baseKey }

  const metadata = new Map(toc.map((icon) => [icon.id, icon])).get(baseKey)
  if (!metadata) return { kind: 'fallback', name: baseKey }

  const variantKey = segments[1] as keyof typeof ICON_VARIANTS
  const variantFlag = ICON_VARIANTS[variantKey]
  let variant: string =
    variantFlag && metadata.param[variantFlag] ? variantKey : 'Mono'
  // These published variants are not represented by the package's toc flags.
  if (
    (baseKey === 'Gemma' && segments[1] === 'Simple') ||
    (baseKey === 'LobeHub' && segments[1] === 'Morden')
  ) {
    variant = segments[1]
  }
  const propStartIndex =
    segments.length > 1 && /^[A-Z]/.test(segments[1]) ? 2 : 1
  const cacheKey = `${baseKey}.${variant}`

  // Parse chained properties (e.g., "type={'platform'}", "shape='square'")
  const props: Record<string, string | number | boolean> = {}
  for (let i = propStartIndex; i < segments.length; i += 1) {
    const seg = segments[i]
    if (!seg) continue

    const eqIdx = seg.indexOf('=')
    if (eqIdx === -1) {
      props[seg.trim()] = true
      continue
    }

    const key = seg.slice(0, eqIdx).trim()
    const valRaw = seg.slice(eqIdx + 1).trim()
    props[key] = parseValue(valRaw)
  }

  return {
    kind: 'component',
    IconComponent: getLazyIcon(cacheKey, baseKey, variant),
    props,
  }
}

/** Icon names exposed by the installed catalog plus the custom set. */
export function catalogNames(): string[] {
  const names = (catalog ?? []).flatMap((icon) =>
    icon.param.hasColor ? [icon.id, `${icon.id}.Color`] : [icon.id]
  )
  return [...new Set([...names, ...Object.keys(CUSTOM_ICONS)])].sort()
}
