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
import { COST_RANGE, REWARD_POOL } from '../constants'
import type { DrawResult, LuckyReward } from '../types'

/** 在投入区间内随机一个金额（到分）。测试阶段仅展示，不扣余额 */
export function randomCost(): number {
  const { min, max } = COST_RANGE
  const cents = Math.round((min + Math.random() * (max - min)) * 100)
  return cents / 100
}

/** 按权重从固定测试池抽取一档（纯函数，便于后续替换为真实接口） */
export function drawReward(): LuckyReward {
  const total = REWARD_POOL.reduce((sum, reward) => sum + reward.weight, 0)
  let roll = Math.random() * total
  for (const reward of REWARD_POOL) {
    roll -= reward.weight
    if (roll < 0) {
      return reward
    }
  }
  return REWARD_POOL[0]
}

export function drawOnce(): DrawResult {
  return { reward: drawReward(), cost: randomCost() }
}
