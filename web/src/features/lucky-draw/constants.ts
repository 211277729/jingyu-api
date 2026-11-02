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
import type { LuckyRarity, LuckyReward } from './types'

/** 每次抽取的投入金额区间（美元）。测试阶段仅展示，后续可改为后端下发 */
export const COST_RANGE = { min: 2, max: 5 } as const

/** 统一灰闪的起步时长（毫秒），给玩家一点"开箱"悬念 */
export const FLICKER_LEAD_MS = 600

/** 每格定格间隔（毫秒）：格数越多，从闪动到全部揭示的总时长越长 */
export const REVEAL_INTERVAL_MS = 420

/** 稀有度档位的格子/徽标配色，测试用固定配色 */
export const RARITY_STYLES: Record<
  LuckyRarity,
  { cell: string; badge: string; labelKey: string }
> = {
  common: {
    cell: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    badge:
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    labelKey: 'Common reward',
  },
  rare: {
    cell: 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400',
    badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    labelKey: 'Rare reward',
  },
  epic: {
    cell: 'border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400',
    badge:
      'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    labelKey: 'Epic reward',
  },
  legendary: {
    cell: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    badge:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    labelKey: 'Legendary reward',
  },
}

/**
 * 测试奖励池：1~12 格共 12 档固定占位奖励。
 * 名称与权重均为测试数据（权重合计 100），待真实奖励设计后整体替换。
 */
export const REWARD_POOL: LuckyReward[] = [
  { cells: 1, name: '测试奖励 · I', rarity: 'common', weight: 26 },
  { cells: 2, name: '测试奖励 · II', rarity: 'common', weight: 20 },
  { cells: 3, name: '测试奖励 · III', rarity: 'common', weight: 14 },
  { cells: 4, name: '测试奖励 · IV', rarity: 'rare', weight: 10 },
  { cells: 5, name: '测试奖励 · V', rarity: 'rare', weight: 8 },
  { cells: 6, name: '测试奖励 · VI', rarity: 'rare', weight: 6 },
  { cells: 7, name: '测试奖励 · VII', rarity: 'epic', weight: 5 },
  { cells: 8, name: '测试奖励 · VIII', rarity: 'epic', weight: 4 },
  { cells: 9, name: '测试奖励 · IX', rarity: 'epic', weight: 3 },
  { cells: 10, name: '测试奖励 · X', rarity: 'legendary', weight: 2 },
  { cells: 11, name: '测试奖励 · XI', rarity: 'legendary', weight: 1.5 },
  { cells: 12, name: '测试奖励 · XII', rarity: 'legendary', weight: 0.5 },
]
