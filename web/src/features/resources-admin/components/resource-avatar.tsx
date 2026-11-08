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
import { KIND_STYLES } from '@/features/resources/lib'
import { getLobeIcon } from '@/lib/lobe-icon'
import { cn } from '@/lib/utils'

import type { ResourceAdminItem } from '../types'

/** 图标位：@lobehub/icons 图标名优先，缺省回落首字母（与资源广场卡片同约定） */
export function ResourceAvatar({ row }: { row: ResourceAdminItem }) {
  return (
    <span
      className={cn(
        'border-border/50 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-gradient-to-br text-xs font-semibold',
        KIND_STYLES[row.kind].chip
      )}
    >
      {row.icon_name ? (
        getLobeIcon(row.icon_name, 18)
      ) : (
        <span className='text-foreground/70'>
          {row.name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  )
}
