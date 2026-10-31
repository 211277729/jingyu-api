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
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'

import type { SystemStatus } from '../types'

/**
 * 未勾选法律条款时的弹窗确认流程：
 * confirmLegalConsent() 已勾选（或站点未开启协议）时立即返回 true，
 * 否则弹出确认框，用户点「我已阅读并同意」则自动勾选并返回 true，
 * 点「取消」或关闭弹窗返回 false，由调用方中断本次登录/注册。
 */
export function useLegalConsentPrompt(
  status: SystemStatus | null,
  agreed: boolean,
  onAgree: () => void
) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const hasUserAgreement = Boolean(status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(status?.privacy_policy_enabled)
  const requiresLegalConsent = hasUserAgreement || hasPrivacyPolicy

  const confirmLegalConsent = useCallback(() => {
    if (!requiresLegalConsent || agreed) {
      return Promise.resolve(true)
    }
    return new Promise<boolean>((resolve) => {
      resolveRef.current?.(false)
      resolveRef.current = resolve
      setOpen(true)
    })
  }, [requiresLegalConsent, agreed])

  const settle = (value: boolean) => {
    setOpen(false)
    resolveRef.current?.(value)
    resolveRef.current = null
    if (value) {
      onAgree()
    }
  }

  const legalConsentDialog = (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          settle(false)
        }
      }}
      title={t('Please agree to the legal terms first')}
      contentClassName='max-w-sm'
      headerClassName='text-left'
      footer={
        <>
          <Button type='button' variant='outline' onClick={() => settle(false)}>
            {t('Cancel')}
          </Button>
          <Button type='button' onClick={() => settle(true)}>
            {t('I have read and agree')}
          </Button>
        </>
      }
    >
      <p className='text-muted-foreground text-sm leading-6'>
        {t('I have read and agree to the')}{' '}
        {hasUserAgreement && (
          <a
            href='/user-agreement'
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary hover:underline'
          >
            {t('User Agreement')}
          </a>
        )}
        {hasUserAgreement && hasPrivacyPolicy && ' and the '}
        {hasPrivacyPolicy && (
          <a
            href='/privacy-policy'
            target='_blank'
            rel='noopener noreferrer'
            className='text-primary hover:underline'
          >
            {t('Privacy Policy')}
          </a>
        )}
        .
      </p>
    </Dialog>
  )

  return { confirmLegalConsent, legalConsentDialog }
}
