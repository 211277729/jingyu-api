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
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

type CaptchaProvider = 'none' | 'turnstile' | 'pow'

const botProtectionSchema = z.object({
  'captcha_setting.provider': z.enum(['none', 'turnstile', 'pow']),
  TurnstileSiteKey: z.string().optional(),
  TurnstileSecretKey: z.string().optional(),
  'captcha_setting.pow_difficulty': z
    .string()
    .refine(
      (v) => Number.isInteger(Number(v)) && Number(v) >= 12 && Number(v) <= 26,
      { message: '12 - 26' }
    ),
  'captcha_setting.pow_challenge_ttl': z
    .string()
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 30, {
      message: '>= 30',
    }),
  'register_limit_setting.enabled': z.boolean(),
  'register_limit_setting.ip_num': z
    .string()
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, {
      message: '>= 1',
    }),
  'register_limit_setting.ip_duration_seconds': z
    .string()
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, {
      message: '>= 1',
    }),
  'register_limit_setting.global_num': z
    .string()
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, {
      message: '>= 1',
    }),
  'register_limit_setting.global_duration_seconds': z
    .string()
    .refine((v) => Number.isInteger(Number(v)) && Number(v) >= 1, {
      message: '>= 1',
    }),
})

type BotProtectionFormValues = z.infer<typeof botProtectionSchema>

// 数值字段提交时转成数字，布尔与字符串原样透传。
function serializeValue(key: keyof BotProtectionFormValues, value: unknown) {
  if (typeof value === 'string' && key !== 'captcha_setting.provider') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return value
}

type BotProtectionSectionProps = {
  defaultValues: BotProtectionFormValues
}

export function BotProtectionSection({
  defaultValues,
}: BotProtectionSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<BotProtectionFormValues>({
    resolver: zodResolver(botProtectionSchema),
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const provider = form.watch('captcha_setting.provider')
  const registerLimitEnabled = form.watch('register_limit_setting.enabled')

  const onSubmit = async (data: BotProtectionFormValues) => {
    for (const [key, value] of Object.entries(data)) {
      if (value === defaultValues[key as keyof BotProtectionFormValues]) {
        continue
      }
      await updateOption.mutateAsync({
        key,
        value: serializeValue(key as keyof BotProtectionFormValues, value),
      })
    }
  }

  return (
    <SettingsSection title={t('Bot Protection')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />

          <FormField
            control={form.control}
            name='captcha_setting.provider'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Human Verification Method')}</FormLabel>
                <FormDescription>
                  {t(
                    'Protect login, registration and other sensitive actions against bots'
                  )}
                </FormDescription>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      <SelectItem value='none'>{t('Off')}</SelectItem>
                      <SelectItem value='turnstile'>
                        {t('Cloudflare Turnstile')}
                      </SelectItem>
                      <SelectItem value='pow'>
                        {t('PoW (Proof of Work, self-hosted)')}
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {provider === 'turnstile' && (
            <>
              <FormField
                control={form.control}
                name='TurnstileSiteKey'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Site Key')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('Your Turnstile site key')}
                        autoComplete='off'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='TurnstileSecretKey'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Secret Key')}</FormLabel>
                    <FormControl>
                      <Input
                        type='password'
                        placeholder={t('Your Turnstile secret key')}
                        autoComplete='new-password'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {provider === 'pow' && (
            <>
              <FormField
                control={form.control}
                name='captcha_setting.pow_difficulty'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('PoW difficulty (leading zero bits)')}
                    </FormLabel>
                    <FormDescription>
                      {t(
                        'Larger values make clients spend more time solving (12-26)'
                      )}
                    </FormDescription>
                    <FormControl>
                      <Input type='number' min={12} max={26} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='captcha_setting.pow_challenge_ttl'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Challenge TTL (seconds)')}</FormLabel>
                    <FormDescription>
                      {t(
                        'How long a PoW challenge stays valid after issuance (30-600)'
                      )}
                    </FormDescription>
                    <FormControl>
                      <Input type='number' min={30} max={600} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <FormField
            control={form.control}
            name='register_limit_setting.enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Registration rate limiting')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Throttle registrations per IP and site-wide; counts apply to registration attempts'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          {registerLimitEnabled && (
            <>
              <div className='grid grid-cols-2 gap-4'>
                <FormField
                  control={form.control}
                  name='register_limit_setting.ip_num'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Per-IP limit (registrations)')}</FormLabel>
                      <FormControl>
                        <Input type='number' min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='register_limit_setting.ip_duration_seconds'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Per-IP window (seconds)')}</FormLabel>
                      <FormControl>
                        <Input type='number' min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='register_limit_setting.global_num'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('Site-wide limit (registrations)')}
                      </FormLabel>
                      <FormControl>
                        <Input type='number' min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='register_limit_setting.global_duration_seconds'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Site-wide window (seconds)')}</FormLabel>
                      <FormControl>
                        <Input type='number' min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
