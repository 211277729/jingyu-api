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
import { cn } from '@/lib/utils'

import { CodeBlock } from './code-block'

export type StepItem = {
  text: string
  snippet?: {
    /** Optional file path or shell name shown above the snippet. */
    label?: string
    code: string
  }
  /**
   * Optional screenshot for this step, reserved for future UI captures.
   *
   * Undefined today, so nothing renders; filling it in later (an imported
   * asset path) shows the image without touching this component.
   */
  image?: string
  /** Accessible description for `image`; defaults to the step text. */
  imageAlt?: string
}

/**
 * Numbered how-to list shared by the quick-start blocks and the tool guide
 * cards, so every setup path on the page looks and behaves the same.
 *
 * Always-dark styling: the docs page is an immersive dark console that does
 * not follow the site theme.
 */
export function StepList(props: { steps: StepItem[]; className?: string }) {
  return (
    <ol className={cn('space-y-6', props.className)}>
      {props.steps.map((step, index) => (
        <li key={step.text} className='relative flex gap-3.5'>
          {index < props.steps.length - 1 && (
            <span
              className='absolute top-9 bottom-[-1.5rem] w-px bg-gradient-to-b from-violet-400/40 to-transparent'
              aria-hidden='true'
              style={{ left: 15 }}
            />
          )}
          <span
            className='mt-0 flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-sm font-semibold text-violet-300 ring-1 ring-violet-400/30'
            aria-hidden='true'
          >
            {index + 1}
          </span>
          <div className='mt-0.5 min-w-0 flex-1 space-y-2'>
            <p className='text-sm leading-relaxed text-zinc-200'>{step.text}</p>
            {step.snippet != null && (
              <CodeBlock code={step.snippet.code} label={step.snippet.label} />
            )}
            {step.image != null && (
              <img
                src={step.image}
                alt={step.imageAlt ?? step.text}
                loading='lazy'
                className='max-w-md rounded-lg ring-1 ring-white/10'
              />
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
