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

/** 稀有度档位：决定格子定格后的配色与文案 */
export type LuckyRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface LuckyReward {
  /** 奖励档位对应的格子数，1~12；格数越多揭示动画越久 */
  cells: number
  /** 测试占位名称，真实奖励设计好后整体替换 */
  name: string
  rarity: LuckyRarity
  /** 加权抽取权重（仅测试用），越大越容易抽中 */
  weight: number
}

export interface DrawResult {
  reward: LuckyReward
  /** 本次随机投入金额（美元）。测试阶段仅展示，不扣余额、不入账 */
  cost: number
}
