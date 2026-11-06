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
import { Gem } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { RARITY_STYLES } from '../constants'
import type { LuckyRarity } from '../types'

interface RevealCellsProps {
  /** 抽中的格子数（1~12），决定网格列数与揭示总时长 */
  cells: number
  rarity: LuckyRarity
  /** 已定格的格子数量，随动画逐格递增 */
  revealedCount: number
  /** 是否已经至少抽取过一次；未抽取时显示占位提示 */
  started: boolean
}

/** 1/2/3 格用对应列数铺满，4 格及以上固定 4 列换行 */
const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
}

/**
 * 仿三角洲开箱的格子组件：所有格子先灰色闪动，按序号从左到右
 * 逐格定格为稀有度配色，格数越多整体揭示越久。
 */
export function RevealCells({
  cells,
  rarity,
  revealedCount,
  started,
}: RevealCellsProps) {
  const { t } = useTranslation()
  const rarityStyle = RARITY_STYLES[rarity]

  if (!started) {
    return (
      <div className='border-border/60 bg-muted/30 flex h-40 items-center justify-center rounded-xl border border-dashed'>
        <span className='text-muted-foreground text-sm'>
          {t('Press draw to reveal your reward')}
        </span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'grid justify-center gap-2',
        GRID_COLS[cells] ?? 'grid-cols-4'
      )}
    >
      {Array.from({ length: cells }, (_, index) => {
        const revealed = index < revealedCount
        return (
          <div
            key={index}
            className={cn(
              'flex size-16 items-center justify-center rounded-lg border transition-colors sm:size-20',
              revealed
                ? cn(rarityStyle.cell, 'lucky-cell-pop')
                : 'border-border bg-muted/60 lucky-cell-flicker'
            )}
          >
            <Gem className={cn('size-6', revealed ? '' : 'opacity-50')} />
          </div>
        )
      })}
    </div>
  )
}
