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
import { Loader2, LogIn } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Turnstile } from '@/components/turnstile'
import { phoneLogin, sendPhoneVerification } from '@/features/auth/api'
import { EMAIL_VERIFICATION_COUNTDOWN } from '@/features/auth/constants'
import { useAuthRedirect } from '@/features/auth/hooks/use-auth-redirect'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'
import {
  isValidPhoneInput,
  normalizePhoneInput,
} from '@/features/auth/lib/validation'
import { useCountdown } from '@/hooks/use-countdown'
import { handleServerError } from '@/lib/handle-server-error'
import { AuthOperationError } from '@/lib/secure-verification'
import { createServerError } from '@/lib/server-error-message'

interface PhoneLoginFormProps {
  redirectTo?: string
  confirmLegalConsent: () => Promise<boolean>
  loginFailedMessage: string
}

export function PhoneLoginForm({
  redirectTo,
  confirmLegalConsent,
  loginFailedMessage,
}: PhoneLoginFormProps) {
  const { t } = useTranslation()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0)
  const {
    isTurnstileEnabled,
    turnstileSiteKey,
    turnstileToken,
    setTurnstileToken,
    validateTurnstile,
  } = useTurnstile()
  const { secondsLeft, isActive, start } = useCountdown({
    initialSeconds: EMAIL_VERIFICATION_COUNTDOWN,
  })
  const { handleLoginResult } = useAuthRedirect()

  const handleSendCode = async () => {
    if (!isValidPhoneInput(phone)) {
      toast.error(t('Please enter a valid phone number'))
      return
    }
    if (!validateTurnstile()) return

    const submittedTurnstileToken = turnstileToken
    if (isTurnstileEnabled) {
      setTurnstileToken('')
      setTurnstileWidgetKey((current) => current + 1)
    }

    setIsSending(true)
    try {
      const res = await sendPhoneVerification(
        normalizePhoneInput(phone),
        submittedTurnstileToken
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

  const handleSubmit = async () => {
    if (!(await confirmLegalConsent())) {
      return
    }
    if (!isValidPhoneInput(phone)) {
      toast.error(t('Please enter a valid phone number'))
      return
    }
    if (!code.trim()) {
      toast.error(t('Please enter the verification code'))
      return
    }
    if (!validateTurnstile()) return

    const submittedTurnstileToken = turnstileToken
    if (isTurnstileEnabled) {
      setTurnstileToken('')
      setTurnstileWidgetKey((current) => current + 1)
    }

    setIsSubmitting(true)
    try {
      const res = await phoneLogin({
        phone: normalizePhoneInput(phone),
        code: code.trim(),
        turnstile: submittedTurnstileToken,
      })
      if (res.success) {
        if (await handleLoginResult(res.data, redirectTo)) {
          toast.success(t('Welcome back!'))
        }
      } else {
        handleServerError(createServerError(res, loginFailedMessage))
      }
    } catch (error: unknown) {
      handleServerError(AuthOperationError.from(error, loginFailedMessage))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='grid gap-4'>
      {/* Phone Field */}
      <div className='grid gap-2'>
        <label className='text-sm leading-none font-medium' htmlFor='phone'>
          {t('Phone Number')}
        </label>
        <Input
          id='phone'
          type='tel'
          inputMode='numeric'
          autoComplete='tel'
          placeholder={t('Enter your phone number')}
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </div>

      {/* Code Field */}
      <div className='grid gap-2'>
        <label
          className='text-sm leading-none font-medium'
          htmlFor='phone-code'
        >
          {t('Verification code')}
        </label>
        <div className='flex gap-2'>
          <Input
            id='phone-code'
            inputMode='numeric'
            maxLength={4}
            autoComplete='one-time-code'
            placeholder={t('Enter the verification code')}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <Button
            type='button'
            variant='outline'
            className='shrink-0'
            disabled={isSending || (isActive && secondsLeft > 0)}
            onClick={handleSendCode}
          >
            {isSending ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : null}
            {isActive && secondsLeft > 0
              ? t('{{seconds}}s', { seconds: secondsLeft })
              : t('Send code')}
          </Button>
        </div>
      </div>

      <p className='text-muted-foreground text-xs'>
        {t(
          'If the phone number is not associated with an account, a new account will be created automatically.'
        )}
      </p>

      {/* Submit Button */}
      <Button
        type='button'
        className='mt-2 w-full justify-center gap-2'
        disabled={isSubmitting}
        onClick={handleSubmit}
      >
        {isSubmitting ? <Loader2 className='animate-spin' /> : <LogIn />}
        {t('Sign in')}
      </Button>

      {/* Turnstile */}
      {isTurnstileEnabled && (
        <div className='mt-2'>
          <Turnstile
            key={turnstileWidgetKey}
            siteKey={turnstileSiteKey}
            onVerify={setTurnstileToken}
            onExpire={() => setTurnstileToken('')}
          />
        </div>
      )}
    </div>
  )
}
