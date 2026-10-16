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
import { Suspense, useSyncExternalStore } from 'react'

import {
  getIconCatalogSnapshot,
  renderIconFallback,
  resolveLobeIcon,
  subscribeCatalog,
} from './lobe-icon-internal'

function useIconCatalog() {
  return useSyncExternalStore(
    subscribeCatalog,
    getIconCatalogSnapshot,
    () => null
  )
}

type LobeIconViewProps = {
  iconName: string | undefined | null
  size: number
}

export function LobeIconView(props: LobeIconViewProps) {
  const { iconName, size } = props
  const toc = useIconCatalog()
  const resolved = resolveLobeIcon(iconName, toc)
  if (resolved.kind === 'custom') {
    return <resolved.CustomIcon size={size} />
  }
  if (resolved.kind === 'component') {
    const { IconComponent, props: iconProps } = resolved
    // Set size if not explicitly specified in the string
    if (iconProps.size == null && size != null) {
      iconProps.size = size
    }
    return (
      <Suspense
        fallback={renderIconFallback(
          (typeof iconName === 'string' ? iconName.split('.')[0] : '') || '?',
          typeof iconProps.size === 'number' || typeof iconProps.size === 'string'
            ? iconProps.size
            : size
        )}
      >
        <IconComponent {...iconProps} />
      </Suspense>
    )
  }
  return renderIconFallback(resolved.name, size)
}
