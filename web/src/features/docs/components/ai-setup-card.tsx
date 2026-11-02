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
import { Bot, ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/copy-button'
import { handleServerError } from '@/lib/handle-server-error'
import { requireServerSuccess } from '@/lib/server-error-message'

import { generateSetupCode, type SetupCode } from '../api'

interface AiSetupCardProps {
  /** Gateway origin without a trailing slash, e.g. `https://example.com`. */
  origin: string
}

/**
 * "Configure with AI" card shown at the top of the docs page.
 *
 * Two numbered actions: the user generates a one-time setup code, then copies
 * the agent prompt. The prompt stays collapsed — the copy action is the point;
 * the full text is one click away for anyone who wants to read it. With a
 * setup code the agent fetches the API key itself, so the user never handles
 * an `sk-…` value.
 */
export function AiSetupCard(props: AiSetupCardProps) {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const [setupCode, setSetupCode] = useState<SetupCode | null>(null)
  const [generating, setGenerating] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)

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
    try {
      const result = requireServerSuccess(await generateSetupCode())
      if (result.data) {
        setSetupCode(result.data)
        toast.success(t('Setup code generated'))
      }
    } catch (error) {
      handleServerError(error, t('Failed to generate the setup code'))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className='ring-foreground/10 bg-muted/30 space-y-4 rounded-xl px-4 py-4 ring-1'>
      <div className='flex items-center gap-2'>
        <Bot className='text-primary size-4 shrink-0' aria-hidden='true' />
        <h2 className='text-sm font-semibold'>{t('Configure with AI')}</h2>
      </div>
      <p className='text-muted-foreground text-xs leading-relaxed'>
        {t(
          'Paste the prompt below into an AI coding agent such as Claude Code or Codex, and it will read the machine-readable guide at {{url}} and set everything up for you.',
          { url: docsUrl }
        )}
      </p>

      <ol className='space-y-3.5'>
        <li className='flex gap-3'>
          <span
            className='bg-foreground text-background mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold'
            aria-hidden='true'
          >
            1
          </span>
          <div className='min-w-0 flex-1 space-y-2'>
            {user ? (
              <Button
                variant={setupCode ? 'outline' : 'default'}
                size='sm'
                onClick={() => void generate()}
                disabled={generating}
              >
                {setupCode
                  ? t('Regenerate setup code')
                  : t('Generate a setup code')}
              </Button>
            ) : (
              <Button
                variant='outline'
                size='sm'
                render={<Link to='/sign-in' />}
              >
                {t('Sign in to generate a setup code')}
              </Button>
            )}
            {setupCode && (
              <div className='space-y-1.5'>
                <div className='bg-background ring-primary/30 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg px-3 py-2 ring-1'>
                  <span className='text-muted-foreground text-xs font-semibold'>
                    {t('Setup code')}
                  </span>
                  <code className='font-mono text-base font-semibold tracking-widest'>
                    {setupCode.code}
                  </code>
                  <CopyButton
                    value={setupCode.code}
                    className='size-6'
                    iconClassName='size-3.5'
                    aria-label={t('Copy setup code')}
                  />
                </div>
                <p className='text-muted-foreground text-xs'>
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
              </div>
            )}
            {!user && (
              <p className='text-muted-foreground text-xs'>
                {t(
                  'A setup code lets your AI agent fetch the API key itself, so you never have to copy the sk- value around.'
                )}
              </p>
            )}
          </div>
        </li>
        <li className='flex gap-3'>
          <span
            className='bg-foreground text-background mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold'
            aria-hidden='true'
          >
            2
          </span>
          <div className='min-w-0 flex-1 space-y-2'>
            <div className='flex flex-wrap items-center gap-2'>
              <CopyButton
                value={prompt}
                variant={setupCode ? 'default' : 'outline'}
                size='sm'
              >
                {t('Copy the prompt')}
              </CopyButton>
              <Button
                variant='ghost'
                size='sm'
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
            {showPrompt && (
              <pre className='ring-foreground/10 bg-background max-h-56 overflow-auto rounded-lg px-3 py-2 text-xs leading-relaxed ring-1'>
                {prompt}
              </pre>
            )}
          </div>
        </li>
      </ol>
    </div>
  )
}
