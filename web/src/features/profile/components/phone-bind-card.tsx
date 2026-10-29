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
import { Loader2, Phone } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Turnstile } from '@/components/turnstile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TitledCard } from '@/components/ui/titled-card'
import {
  phoneBind,
  sendPhoneBindVerification,
} from '@/features/auth/api'
import { EMAIL_VERIFICATION_COUNTDOWN } from '@/features/auth/constants'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'
import {
  isValidPhoneInput,
  normalizePhoneInput,
} from '@/features/auth/lib/validation'
import { useCountdown } from '@/hooks/use-countdown'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'
import { createServerError } from '@/lib/server-error-message'

interface PhoneBindCardProps {
  phone?: string
  enabled: boolean
}

export function PhoneBindCard({ phone, enabled }: PhoneBindCardProps) {
  const { t } = useTranslation()
  const [inputPhone, setInputPhone] = useState(phone ?? '')
  const [code, setCode] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const {
    isTurnstileEnabled,
    turnstileSiteKey: siteKey,
    turnstileToken,
    setTurnstileToken,
    validateTurnstile,
  } = useTurnstile()
  const { secondsLeft, isActive, start } = useCountdown({
    initialSeconds: EMAIL_VERIFICATION_COUNTDOWN,
  })
  const currentPhone = normalizePhoneInput(phone ?? '')

  const handleSendCode = async () => {
    if (!isValidPhoneInput(inputPhone)) {
      toast.error(t('Please enter a valid phone number'))
      return
    }
    if (!validateTurnstile()) return
    setIsSending(true)
    try {
      const res = await sendPhoneBindVerification(
        normalizePhoneInput(inputPhone),
        turnstileToken
      )
      if (res?.success) {
        start()
        toast.success(t('Verification code sent'))
      } else {
        handleServerError(
          createServerError(res, t('Failed to send verification code'))
        )
      }
    } catch (error: unknown) {
      handleServerError(
        AuthOperationError.from(error, t('Failed to send verification code'))
      )
    } finally {
      setIsSending(false)
    }
  }

  const handleBind = async () => {
    if (!isValidPhoneInput(inputPhone)) {
      toast.error(t('Please enter a valid phone number'))
      return
    }
    if (!code.trim()) {
      toast.error(t('Please enter the verification code'))
      return
    }
    setIsSubmitting(true)
    try {
      const res = await phoneBind({
        phone: normalizePhoneInput(inputPhone),
        code: code.trim(),
      })
      if (res?.success) {
        setCode('')
        toast.success(t('Phone number bound successfully'))
      } else {
        handleServerError(
          createServerError(res, t('Failed to bind phone number'))
        )
      }
    } catch (error: unknown) {
      handleServerError(
        AuthOperationError.from(error, t('Failed to bind phone number'))
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!enabled) {
    return null
  }

  return (
    <TitledCard
      title={t('Phone Number')}
      description={t('Bind your phone number to sign in with SMS codes')}
      icon={<Phone className='h-4 w-4' />}
      iconTone='info'
      disableHoverEffect
    >
      <div className='space-y-4'>
        {currentPhone && (
          <p className='text-muted-foreground text-sm'>
            {t('Current phone number')}: {currentPhone}
          </p>
        )}
        <div className='flex gap-2'>
          <Input
            type='tel'
            inputMode='numeric'
            placeholder={t('Enter your phone number')}
            value={inputPhone}
            onChange={(event) => setInputPhone(event.target.value)}
          />
          <Button
            type='button'
            variant='outline'
            className='shrink-0'
            disabled={isSending || (isActive && secondsLeft > 0)}
            onClick={handleSendCode}
          >
            {isSending ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
            {isActive && secondsLeft > 0
              ? t('{{seconds}}s', { seconds: secondsLeft })
              : t('Send code')}
          </Button>
        </div>
        <div className='flex gap-2'>
          <Input
            inputMode='numeric'
            maxLength={4}
            autoComplete='one-time-code'
            placeholder={t('Enter the verification code')}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <Button
            type='button'
            className='shrink-0'
            disabled={isSubmitting}
            onClick={handleBind}
          >
            {isSubmitting ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : null}
            {currentPhone ? t('Update') : t('Bind')}
          </Button>
        </div>
        {isTurnstileEnabled && (
          <Turnstile
            siteKey={siteKey}
            onVerify={setTurnstileToken}
            onExpire={() => setTurnstileToken('')}
          />
        )}
      </div>
    </TitledCard>
  )
}
