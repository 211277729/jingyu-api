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

/** 命令动词（行首的 export / claude / codex 等）渲染为薄荷绿，空格开头视为延续行不重复高亮。 */
const COMMAND_RE =
  /^(\s*)(export|curl|claude|codex|gemini|npm|npx|docker|uvx)\b/

/** 生成内容相关的 React key：同一行的重复片段用出现序号区分。 */
function uniqueKey(builder: Map<string, number>, base: string) {
  const count = builder.get(base) ?? 0
  builder.set(base, count + 1)
  return `${base}#${count}`
}

/**
 * 单行代码着色：注释行灰、双引号字符串青蓝、行首命令动词薄荷绿，
 * 其余正文用高对比的浅灰白，保证在浅色卡片内的深色面板上依然易读。
 */
function SnippetLine(props: { line: string }) {
  const { line } = props
  if (line.trimStart().startsWith('#')) {
    return <span className='block text-zinc-500'>{line}</span>
  }
  if (line === '') {
    return <span className='block text-zinc-200'>{'\u00a0'}</span>
  }
  const pieces = line.split(/("[^"]*")/g).filter((piece) => piece !== '')
  // 行首命令动词（export / claude 等）单独高亮；命中时首个片段已由它开头。
  const commandMatch = COMMAND_RE.exec(pieces[0] ?? '')
  const [, ...plainPieces] = commandMatch ? pieces : [null, ...pieces]
  const snippetKeys = new Map<string, number>()

  return (
    <span className='block text-zinc-200'>
      {commandMatch ? (
        <span
          key={uniqueKey(snippetKeys, '#command')}
          className='text-emerald-400'
        >
          {commandMatch[0]}
        </span>
      ) : null}
      {commandMatch ? pieces[0].slice(commandMatch[0].length) : null}
      {plainPieces.map((piece) => (
        <span
          key={uniqueKey(snippetKeys, piece)}
          className={piece.startsWith('"') ? 'text-sky-300' : undefined}
        >
          {piece}
        </span>
      ))}
    </span>
  )
}

/**
 * 资源页专属的代码块：实底深色面板落在浅色页面上，直接取替
 * docs 页共享的 CodeBlock（其暗底白字设计在浅色主题下发糊）——
 * 注释、命令、字符串三档配色，label 与复制按钮不再隐身。
 */
export function SnippetBlock(props: {
  label: string
  code: string
  className?: string
}) {
  const codeKeys = new Map<string, number>()
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg bg-zinc-950 shadow-sm ring-1 ring-white/10',
        props.className
      )}
    >
      <div className='flex items-center gap-1.5 border-b border-white/10 px-3 py-1.5'>
        <span className='truncate font-mono text-xs font-medium text-zinc-400'>
          {props.label}
        </span>
        <CopyButton
          value={props.code}
          className='ml-auto text-zinc-400 hover:bg-white/10 hover:text-zinc-100'
          iconClassName='size-3.5'
        />
      </div>
      <pre className='overflow-x-auto px-3 py-2.5 font-mono text-xs leading-relaxed'>
        <code>
          {props.code.split('\n').map((line) => (
            <SnippetLine key={uniqueKey(codeKeys, line)} line={line} />
          ))}
        </code>
      </pre>
    </div>
  )
}
