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
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { SystemStatus } from '../types'

interface LegalConsentProps {
  status: SystemStatus | null
  className?: string
}

/** 登录/注册页的协议提示：仅展示文案与链接，不再要求勾选确认。 */
export function LegalConsent({ status, className }: LegalConsentProps) {
  const { t } = useTranslation()
  const hasUserAgreement = Boolean(status?.user_agreement_enabled)
  const hasPrivacyPolicy = Boolean(status?.privacy_policy_enabled)

  if (!hasUserAgreement && !hasPrivacyPolicy) {
    return null
  }

  return (
    <p className={cn('text-muted-foreground text-xs leading-5', className)}>
      {t('By signing in, you have read and agreed to our')}{' '}
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
      {hasUserAgreement && hasPrivacyPolicy && ` ${t('and')} `}
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
  )
}
