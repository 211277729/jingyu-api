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
import { CopyButton } from '@/components/copy-button'
import { cn } from '@/lib/utils'

interface CodeBlockProps {
  code: string
  /** Shown at the left of the header row, usually a file path or a language. */
  label?: string
  className?: string
}

/**
 * Read-only snippet with a copy affordance.
 *
 * Renders semantic `pre` / `code` because the project has no shared code
 * renderer; the copy interaction is delegated to the shared `CopyButton`.
 */
export function CodeBlock(props: CodeBlockProps) {
  return (
    <div
      className={cn(
        'bg-muted/40 ring-foreground/10 overflow-hidden rounded-lg ring-1',
        props.className
      )}
    >
      <div className='flex items-center justify-between gap-2 border-b px-3 py-1.5'>
        <span className='text-muted-foreground truncate font-mono text-xs'>
          {props.label ?? ''}
        </span>
        <CopyButton
          value={props.code}
          className='size-6'
          iconClassName='size-3.5'
        />
      </div>
      <pre className='overflow-x-auto px-3 py-2.5 text-xs leading-relaxed'>
        <code className='font-mono'>{props.code}</code>
      </pre>
    </div>
  )
}
