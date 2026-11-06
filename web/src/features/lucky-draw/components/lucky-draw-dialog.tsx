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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import {
  COST_RANGE,
  FLICKER_LEAD_MS,
  RARITY_STYLES,
  REVEAL_INTERVAL_MS,
} from '../constants'
import { drawOnce } from '../lib/draw'
import type { DrawResult } from '../types'
import { RevealCells } from './reveal-cells'

type LuckyDrawPhase = 'idle' | 'drawing' | 'done'

interface LuckyDrawDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * 幸运抽取弹窗（测试阶段）：前端 mock 抽取，不扣余额、奖励不入账。
 * 流程：点击抽取 → 全部格子灰色闪动 → 逐格定格为稀有度配色 → 展示结果。
 */
export function LuckyDrawDialog({ open, onOpenChange }: LuckyDrawDialogProps) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<LuckyDrawPhase>('idle')
  const [result, setResult] = useState<DrawResult | null>(null)
  const [revealedCount, setRevealedCount] = useState(0)

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPhase('idle')
      setResult(null)
      setRevealedCount(0)
    }
    onOpenChange(next)
  }

  const handleDraw = () => {
    setRevealedCount(0)
    setResult(drawOnce())
    setPhase('drawing')
  }

  // 揭示节奏：起步统一灰闪，随后按格数逐格定格，格数越多整体越久
  useEffect(() => {
    if (phase !== 'drawing' || !result) {
      return
    }
    const timers: number[] = []
    for (let index = 1; index <= result.reward.cells; index += 1) {
      timers.push(
        window.setTimeout(
          () => setRevealedCount(index),
          FLICKER_LEAD_MS + index * REVEAL_INTERVAL_MS
        )
      )
    }
    timers.push(
      window.setTimeout(
        () => setPhase('done'),
        FLICKER_LEAD_MS + (result.reward.cells + 1) * REVEAL_INTERVAL_MS
      )
    )
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [phase, result])

  const drawing = phase === 'drawing'
  const rarityStyle = result ? RARITY_STYLES[result.reward.rarity] : null

  const getButtonLabel = () => {
    if (drawing) {
      return t('Revealing')
    }
    return phase === 'idle' ? t('Draw now') : t('Draw again')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t('Lucky Draw')}
      description={t(
        'Each draw randomly invests ${{min}} ~ ${{max}}. Test mode: nothing is charged and rewards are not credited.',
        { min: COST_RANGE.min.toFixed(2), max: COST_RANGE.max.toFixed(2) }
      )}
      contentClassName='sm:max-w-md'
      contentHeight='auto'
      bodyClassName='space-y-4'
    >
      <div className='space-y-3 py-1'>
        <RevealCells
          cells={result?.reward.cells ?? 3}
          rarity={result?.reward.rarity ?? 'common'}
          revealedCount={revealedCount}
          started={result !== null}
        />

        {result && rarityStyle ? (
          <div className='space-y-2 text-center'>
            <div className='text-muted-foreground text-xs'>
              {t('This draw invested')}{' '}
              <span className='text-foreground font-semibold tabular-nums'>
                ${result.cost.toFixed(2)}
              </span>
            </div>
            {phase === 'done' ? (
              <div className='flex items-center justify-center gap-2'>
                <span
                  className={cn(
                    'rounded-md px-2 py-1 text-xs font-medium',
                    rarityStyle.badge
                  )}
                >
                  {t(rarityStyle.labelKey)}
                </span>
                <span className='text-sm font-semibold'>
                  {result.reward.name}
                </span>
                <span className='text-muted-foreground text-xs tabular-nums'>
                  ×{result.reward.cells}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        <Button
          onClick={handleDraw}
          disabled={drawing}
          size='lg'
          className='h-12 w-full text-base font-semibold'
        >
          {getButtonLabel()}
        </Button>
      </div>
    </Dialog>
  )
}
