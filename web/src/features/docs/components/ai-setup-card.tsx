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
import { Link } from '@tanstack/react-router'
import { Bot, Check, ChevronDown, Copy, ShieldAlert } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'
import { useAuthStore } from '@/stores/auth-store'

import { generateSetupCode, type SetupCode } from '../api'

interface AiSetupCardProps {
  /** Gateway origin without a trailing slash, e.g. `https://example.com`. */
  origin: string
}

/**
 * "Configure with AI" fast lane: a gradient-bordered panel on the dark docs
 * console. Left column drives the two actions (generate setup code, copy the
 * agent prompt); right column is a mini terminal that either demonstrates the
 * agent flow or shows the freshly generated code.
 */
export function AiSetupCard(props: AiSetupCardProps) {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const [setupCode, setSetupCode] = useState<SetupCode | null>(null)
  const [generating, setGenerating] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [codeInvalid, setCodeInvalid] = useState(false)
  const [copied, setCopied] = useState(false)
  const generatedAtRef = useRef(0)
  const { copyToClipboard } = useCopyToClipboard({ notify: false })

  const docsUrl = `${props.origin}/llms.txt`

  const prompt = useMemo(() => {
    if (!setupCode) {
      return t(
        'Read {{url}} and follow it to configure this AI gateway for the tool I am using. I do not have a setup code; ask me for my sk- API key when you need it, then verify the connection with the curl example in the document and report the result.',
        { url: docsUrl }
      )
    }
    return t(
      'Read {{url}} and follow it to configure this AI gateway for the tool I am using. My one-time setup code is {{code}}: redeem it once by POSTing it to /api/setup_code/redeem exactly as the document describes, use the returned sk- key for the configuration, then verify the connection with the curl example and report the result.',
      { url: docsUrl, code: setupCode.code }
    )
  }, [t, docsUrl, setupCode])

  const generate = async () => {
    setGenerating(true)
    setCodeInvalid(false)
    try {
      const result = requireServerSuccess(await generateSetupCode())
      if (result.data) {
        setSetupCode(result.data)
        generatedAtRef.current = Date.now()
        toast.success(t('Setup code generated'))
        return true
      }
      return false
    } catch (error) {
      handleServerError(error, t('Failed to generate the setup code'))
      return false
    } finally {
      setGenerating(false)
    }
  }

  /**
   * A prompt without a fresh setup code makes the agent fall back to asking
   * the user for an sk- key — exactly what this fast lane exists to avoid.
   * So "Copy the prompt" first makes sure a valid code exists: generate one
   * automatically when missing, and refuse when the current one expired.
   */
  const copyPrompt = async () => {
    if (setupCode == null) {
      if (!user) return
      toast.info(t('Generate a setup code first'))
      const ok = await generate()
      if (!ok) return
      toast.success(t('Prompt is ready to copy'))
      return
    }
    // An expired code is dead anyway, so renew it on the spot instead of
    // bouncing the user back to step 1.
    const elapsed = (Date.now() - generatedAtRef.current) / 1000
    if (elapsed >= setupCode.expires_in) {
      setCodeInvalid(true)
      const ok = await generate()
      if (!ok) return
    }
    const success = await copyToClipboard(prompt)
    if (success) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className='rounded-2xl bg-gradient-to-r from-violet-500/60 via-fuchsia-500/40 to-cyan-400/60 p-px'>
      <div className='grid gap-6 rounded-2xl bg-zinc-950/95 p-5 sm:p-7 lg:grid-cols-[1fr_320px] lg:items-center'>
        <div className='space-y-5'>
          <div className='flex flex-wrap items-center gap-3'>
            <span
              className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-md shadow-violet-500/40 [&>svg]:size-4'
              aria-hidden='true'
            >
              <Bot aria-hidden='true' />
            </span>
            <h2 className='text-lg font-semibold text-white sm:text-xl'>
              {t('Configure with AI')}
            </h2>
            <Badge
              variant='secondary'
              className='gap-1 rounded-full border-0 bg-gradient-to-r from-violet-500/25 to-cyan-400/25 text-violet-200 ring-violet-400/40'
            >
              {t('Recommended')}
            </Badge>
          </div>
          <p className='max-w-xl text-sm leading-relaxed text-zinc-400'>
            {t(
              'Paste the prompt below into an AI coding agent such as Claude Code or Codex, and it will read the machine-readable guide at {{url}} and set everything up for you.',
              { url: docsUrl }
            )}
          </p>

          <ol className='space-y-4'>
            <li className='flex gap-3.5'>
              <span
                className='flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white'
                aria-hidden='true'
              >
                1
              </span>
              <div className='min-w-0 flex-1 space-y-2'>
                {user ? (
                  <Button
                    variant='secondary'
                    size='sm'
                    className='bg-white/10 text-white shadow-none ring-1 ring-white/15 hover:bg-white/10 hover:text-white'
                    onClick={() => void generate()}
                    disabled={generating}
                  >
                    {setupCode
                      ? t('Regenerate setup code')
                      : t('Generate a setup code')}
                  </Button>
                ) : (
                  <Button
                    variant='secondary'
                    size='sm'
                    className='bg-white/10 text-white shadow-none ring-1 ring-white/15 hover:bg-white/15'
                    render={<Link to='/sign-in' />}
                  >
                    {t('Sign in to generate a setup code')}
                  </Button>
                )}
                {!user && (
                  <p className='text-xs leading-relaxed text-zinc-500'>
                    {t(
                      'A setup code lets your AI agent fetch the API key itself, so you never have to copy the sk- value around.'
                    )}
                  </p>
                )}
                {setupCode && (
                  <p className='text-xs leading-relaxed text-zinc-500'>
                    {t(
                      'Valid for {{minutes}} minutes, single use. Paste it to your agent together with the prompt.',
                      {
                        minutes: Math.max(
                          1,
                          Math.round(setupCode.expires_in / 60)
                        ),
                      }
                    )}
                  </p>
                )}
              </div>
            </li>
            <li className='flex gap-3.5'>
              <span
                className='flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white'
                aria-hidden='true'
              >
                2
              </span>
              <div className='min-w-0 flex-1 space-y-2'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Button
                    type='button'
                    variant='secondary'
                    size='sm'
                    className='bg-white/10 text-white shadow-none ring-1 ring-white/15 hover:bg-white/15'
                    onClick={() => void copyPrompt()}
                    disabled={generating}
                  >
                    {copied ? (
                      <Check
                        className='text-success size-3.5'
                        aria-hidden='true'
                      />
                    ) : (
                      <Copy className='size-3.5' aria-hidden='true' />
                    )}
                    {copied ? t('Copied!') : t('Copy the prompt')}
                  </Button>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='text-zinc-400 hover:bg-white/10 hover:text-white'
                    onClick={() => setShowPrompt((prev) => !prev)}
                    aria-expanded={showPrompt}
                  >
                    <ChevronDown
                      className={
                        showPrompt
                          ? 'size-3.5 rotate-180 transition-transform'
                          : 'size-3.5 transition-transform'
                      }
                      aria-hidden='true'
                    />
                    {showPrompt
                      ? t('Hide the full prompt')
                      : t('View the full prompt')}
                  </Button>
                </div>
                {codeInvalid && (
                  <p className='ring-destructive/40 bg-destructive/10 text-destructive flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs leading-relaxed ring-1'>
                    <ShieldAlert
                      className='mt-0.5 size-3.5 shrink-0'
                      aria-hidden='true'
                    />
                    {t('Setup code expired, please regenerate it')}
                  </p>
                )}
                {showPrompt && (
                  <pre className='max-h-56 overflow-auto rounded-lg bg-black/40 px-3 py-2 text-xs leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap text-zinc-300 ring-1 ring-white/10'>
                    {prompt}
                  </pre>
                )}
              </div>
            </li>
          </ol>
        </div>

        {/* Mini terminal: shows the code once generated, otherwise
            demonstrates what the agent will do. */}
        <div className='relative overflow-hidden rounded-xl bg-black/40 p-4 ring-1 ring-white/10'>
          <div
            aria-hidden='true'
            className='pointer-events-none absolute -top-10 -right-10 size-32 rounded-full bg-violet-500/15 blur-2xl'
          />
          <div className='relative'>
            {setupCode ? (
              <div className='space-y-3'>
                <p className='font-mono text-[11px] tracking-[0.25em] text-zinc-500 uppercase'>
                  {t('Setup code')}
                </p>
                <div className='flex flex-wrap items-center gap-3'>
                  <code className='text-2xl font-bold tracking-[0.25em] text-white'>
                    {setupCode.code}
                  </code>
                  <CopyButton
                    value={setupCode.code}
                    className='text-zinc-400 hover:bg-white/10 hover:text-zinc-100'
                    iconClassName='size-4'
                    aria-label={t('Copy setup code')}
                  />
                </div>
                <p className='font-mono text-[11px] text-zinc-500'>
                  TTL {Math.max(1, Math.round(setupCode.expires_in / 60))}min ·
                  single use
                </p>
              </div>
            ) : (
              <div className='space-y-1.5 font-mono text-xs leading-relaxed'>
                <p className='text-zinc-500'>
                  $ {t('claude "hook my tools up to this gateway"')}
                </p>
                <p className='text-zinc-400'>{t('Reading llms.txt…')}</p>
                <p className='text-zinc-400'>
                  {t('Redeemed the setup code and got the sk- key ✓')}
                </p>
                <p className='text-zinc-400'>
                  {t('Wrote ~/.claude/settings.json ✓')}
                </p>
                <p className='text-emerald-400'>
                  {t('Done. You can start chatting now.')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
