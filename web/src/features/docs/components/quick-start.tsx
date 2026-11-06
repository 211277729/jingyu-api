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
import { ArrowRight, CheckCircle2, KeyRound, Plug, Wallet } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * The linear zero-to-working path shown at the top of the docs page.
 *
 * Each card links to the section (or page) that carries the detailed steps,
 * so first-time users can follow the page top to bottom without guessing.
 *
 * Always-dark styling: the docs page is an immersive dark console that does
 * not follow the site theme.
 */
export function QuickStart() {
  const { t } = useTranslation()

  const steps = useMemo(
    () => [
      {
        icon: <Wallet className='size-4' aria-hidden='true' />,
        title: t('Check your balance'),
        desc: t(
          'Open Wallet and make sure you have quota left. An empty balance fails requests with an insufficient balance error.'
        ),
        href: '/wallet',
        cta: t('Open Wallet'),
      },
      {
        icon: <KeyRound className='size-4' aria-hidden='true' />,
        title: t('Create an API key'),
        desc: t(
          'Create a key on the API Keys page and copy the sk-… value. Detailed steps below.'
        ),
        href: '/keys',
        cta: t('Open API Keys'),
      },
      {
        icon: <Plug className='size-4' aria-hidden='true' />,
        title: t('Connect your tool'),
        desc: t(
          'CC Switch configures Claude Code, Codex and Gemini CLI for you in one click.'
        ),
        href: '#tools',
        cta: t('See the tool guides'),
      },
      {
        icon: <CheckCircle2 className='size-4' aria-hidden='true' />,
        title: t('Verify the connection'),
        desc: t('Run the cURL snippet and expect a JSON reply.'),
        href: '#verify',
        cta: t('See how to verify'),
      },
    ],
    [t]
  )

  return (
    <ol className='grid gap-3 sm:grid-cols-2'>
      {steps.map((step, index) => (
        <li
          key={step.title}
          className='flex gap-3.5 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10 transition-colors hover:bg-violet-500/[0.06] hover:ring-violet-400/40'
        >
          <span
            className='mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-semibold text-white shadow-md shadow-violet-500/25'
            aria-hidden='true'
          >
            {index + 1}
          </span>
          <div className='min-w-0 flex-1 space-y-1.5'>
            <h3 className='flex items-center gap-1.5 text-sm font-semibold text-white'>
              {step.icon}
              {step.title}
            </h3>
            <p className='text-xs leading-relaxed text-zinc-400'>{step.desc}</p>
            {step.href.startsWith('#') ? (
              <a
                href={step.href}
                className='inline-flex items-center gap-1 text-xs font-medium text-cyan-300 transition-colors hover:text-cyan-200'
              >
                {step.cta}
                <ArrowRight className='size-3' aria-hidden='true' />
              </a>
            ) : (
              <Link
                to={step.href}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center gap-1 text-xs font-medium text-cyan-300 transition-colors hover:text-cyan-200'
              >
                {step.cta}
                <ArrowRight className='size-3' aria-hidden='true' />
              </Link>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
