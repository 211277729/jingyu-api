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
import { Zap } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

/** Vertical squash of the projected orbital plane (screen-space, no 3D). */
const SQUASH = 0.42

type Tool = { labelKey: string }

/** Desktop shows every tool; small screens carry a subset that fits. */
const RING_A_DESKTOP: Tool[] = [
  { labelKey: 'Claude Code' },
  { labelKey: 'Codex' },
  { labelKey: 'Gemini CLI' },
  { labelKey: 'Antigravity' },
  { labelKey: 'CC Switch' },
  { labelKey: 'Cursor' },
  { labelKey: 'DeepSeek Harness' },
  { labelKey: 'Any OpenAI client' },
]
const RING_B_DESKTOP: Tool[] = [
  { labelKey: 'Trae' },
  { labelKey: 'WorkBuddy' },
  { labelKey: 'CodeBuddy' },
  { labelKey: 'Qwen Code' },
  { labelKey: 'Kimi CLI' },
  { labelKey: 'Magpie' },
  { labelKey: 'Cherry Studio' },
]
const RING_A_MOBILE: Tool[] = [
  { labelKey: 'Claude Code' },
  { labelKey: 'Codex' },
  { labelKey: 'Antigravity' },
  { labelKey: 'CC Switch' },
  { labelKey: 'Any OpenAI client' },
]
const RING_B_MOBILE: Tool[] = [
  { labelKey: 'Trae' },
  { labelKey: 'WorkBuddy' },
  { labelKey: 'CodeBuddy' },
  { labelKey: 'Qwen Code' },
]

type OrbitGlobeProps = {
  ringA: Tool[]
  ringB: Tool[]
  /** Semi-major axes (px) of the two ellipses. */
  a1: number
  a2: number
  className?: string
}

/**
 * Screen-space elliptical orbit driven by one rAF loop. Chips translate on
 * the ellipse with zero rotation, so text never squashes; chips on the far
 * side (upper half) dim for a depth cue. Static placement under
 * prefers-reduced-motion.
 */
function OrbitGlobe(props: OrbitGlobeProps) {
  const { t } = useTranslation()
  const stageRef = useRef<HTMLDivElement>(null)
  const chipRefs = useRef<(HTMLSpanElement | null)[]>([])
  const b1 = props.a1 * SQUASH
  const b2 = props.a2 * SQUASH

  useEffect(() => {
    const stage = stageRef.current
    if (stage == null) return

    const chips = chipRefs.current.filter(
      (el): el is HTMLSpanElement => el != null
    )
    const perRing = [props.ringA.length, props.ringB.length]
    if (chips.length !== perRing[0] + perRing[1]) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let raf = 0
    let angle = 0
    let last = performance.now()

    const place = (theta: number) => {
      let chipIndex = 0
      const rings = [
        { a: props.a1, b: b1, speed: 1 },
        { a: props.a2, b: b2, speed: -1 },
      ]
      for (const ring of rings) {
        const count = perRing[chipIndex < props.ringA.length ? 0 : 1]
        for (let i = 0; i < count; i += 1) {
          const chip = chips[chipIndex]
          const thetaI = theta * ring.speed + (Math.PI * 2 * i) / count
          const x = Math.cos(thetaI) * ring.a
          const y = Math.sin(thetaI) * ring.b
          // Far side of the globe (upper half) reads as further away.
          const depth = 0.55 + 0.45 * ((Math.sin(thetaI) + 1) / 2)
          chip.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
          chip.style.opacity = depth.toFixed(2)
          chipIndex += 1
        }
      }
    }

    const tick = (now: number) => {
      // Skip work while the stage is display:none (mobile/desktop twin).
      // The stage is a 0x0 anchor point, so offsetWidth is always 0; use the
      // client-rect list to skip work while display:none (mobile/desktop twin).
      if (stage.getClientRects().length > 0) {
        const dt = Math.min(now - last, 100)
        angle += (dt / 1000) * (Math.PI * 2) * (1 / 36)
        place(angle)
      }
      last = now
      raf = window.requestAnimationFrame(tick)
    }

    if (reduced.matches) {
      place(Math.PI / 3)
    } else {
      raf = window.requestAnimationFrame(tick)
      const onChange = () => {
        if (reduced.matches) {
          window.cancelAnimationFrame(raf)
          place(Math.PI / 3)
        }
      }
      reduced.addEventListener('change', onChange)
      return () => {
        window.cancelAnimationFrame(raf)
        reduced.removeEventListener('change', onChange)
      }
    }
    return () => window.cancelAnimationFrame(raf)
  }, [props.a1, props.a2, props.ringA.length, props.ringB.length, b1, b2])

  const chipIndex = (ring: 'a' | 'b', i: number) =>
    ring === 'a' ? i : props.ringA.length + i

  return (
    <div
      ref={stageRef}
      className={cn('relative', props.className)}
      aria-hidden='true'
      role='presentation'
    >
      {/* Projected orbital outlines: plain 2D ellipses, no transforms. */}
      <div
        className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.09]'
        style={{ width: props.a1 * 2, height: b1 * 2 }}
      />
      <div
        className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]'
        style={{ width: props.a2 * 2, height: b2 * 2 }}
      />

      {(['a', 'b'] as const).map((ring) => {
        const tools = ring === 'a' ? props.ringA : props.ringB
        return tools.map((tool, i) => (
          <span
            key={tool.labelKey}
            ref={(el) => {
              chipRefs.current[chipIndex(ring, i)] = el
            }}
            className='absolute top-1/2 left-1/2 rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium whitespace-nowrap text-zinc-200 shadow-lg ring-1 shadow-black/30 ring-white/15 backdrop-blur-sm will-change-transform'
          >
            {t(tool.labelKey)}
          </span>
        ))
      })}
    </div>
  )
}

/**
 * Decorative "every tool plugs into the gateway" centerpiece: tool badges
 * orbit the hub on two projected ellipses so the whole tool list fits without
 * a static layout. Transform-only updates in screen space — labels stay
 * upright and readable; static under prefers-reduced-motion.
 */
export function GatewayConstellation() {
  const { t } = useTranslation()

  return (
    <div
      className='relative h-56 w-full sm:h-80'
      aria-hidden='true'
      role='presentation'
    >
      {/* Mobile stage */}
      <div className='absolute inset-0 sm:hidden'>
        <OrbitGlobe
          className='absolute top-1/2 left-1/2 size-0'
          ringA={RING_A_MOBILE}
          ringB={RING_B_MOBILE}
          a1={114}
          a2={80}
        />
      </div>
      {/* Desktop stage */}
      <div className='absolute inset-0 hidden sm:block'>
        <OrbitGlobe
          className='absolute top-1/2 left-1/2 size-0'
          ringA={RING_A_DESKTOP}
          ringB={RING_B_DESKTOP}
          a1={280}
          a2={170}
        />
      </div>

      {/* Hub */}
      <div className='absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2'>
        <div className='relative flex flex-col items-center'>
          <div className='relative flex size-20 items-center justify-center'>
            <div className='absolute inset-0 rounded-full bg-violet-500/30 blur-xl' />
            <div className='relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg ring-1 shadow-violet-500/40 ring-white/25'>
              <Zap className='size-6 text-white' aria-hidden='true' />
            </div>
          </div>
          <p className='mt-1.5 text-center text-xs font-semibold text-zinc-300'>
            {t('This gateway')}
          </p>
        </div>
      </div>
    </div>
  )
}
