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
import { useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

import { PasswordInput } from '@/components/password-input'
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
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const smsSchema = z.object({
  sms_setting: z.object({
    enabled: z.boolean(),
    provider: z.enum(['aliyun', 'tencent', 'debug']),
    aliyun_access_key_id: z.string(),
    aliyun_access_secret: z.string(),
    aliyun_sign_name: z.string(),
    aliyun_template_code: z.string(),
    tencent_secret_id: z.string(),
    tencent_secret: z.string(),
    tencent_sdk_app_id: z.string(),
    tencent_sign_name: z.string(),
    tencent_template_id: z.string(),
    tencent_region: z.string(),
  }),
})

type SmsFormInput = z.input<typeof smsSchema>
type SmsFormValues = z.output<typeof smsSchema>

// 敏感字段后端不会回显（GetOptions 过滤），仅在填写了新值时才提交，
// 避免清空已配置的密钥，语义与 SMTPToken 一致。
const SECRET_FIELDS = ['aliyun_access_secret', 'tencent_secret'] as const

const STRING_FIELDS = [
  'aliyun_access_key_id',
  'aliyun_sign_name',
  'aliyun_template_code',
  'tencent_secret_id',
  'tencent_sdk_app_id',
  'tencent_sign_name',
  'tencent_template_id',
  'tencent_region',
] as const

export type FlatSmsSettings = {
  'sms_setting.enabled': boolean
  'sms_setting.provider': 'aliyun' | 'tencent' | 'debug'
  'sms_setting.aliyun_access_key_id': string
  'sms_setting.aliyun_access_secret': string
  'sms_setting.aliyun_sign_name': string
  'sms_setting.aliyun_template_code': string
  'sms_setting.tencent_secret_id': string
  'sms_setting.tencent_secret': string
  'sms_setting.tencent_sdk_app_id': string
  'sms_setting.tencent_sign_name': string
  'sms_setting.tencent_template_id': string
  'sms_setting.tencent_region': string
}

type SmsSettingsSectionProps = {
  defaultValues: FlatSmsSettings
}

const buildFormDefaults = (
  defaults: SmsSettingsSectionProps['defaultValues']
): SmsFormInput => ({
  sms_setting: {
    enabled: defaults['sms_setting.enabled'],
    provider: defaults['sms_setting.provider'],
    aliyun_access_key_id: defaults['sms_setting.aliyun_access_key_id'],
    aliyun_access_secret: '',
    aliyun_sign_name: defaults['sms_setting.aliyun_sign_name'],
    aliyun_template_code: defaults['sms_setting.aliyun_template_code'],
    tencent_secret_id: defaults['sms_setting.tencent_secret_id'],
    tencent_secret: '',
    tencent_sdk_app_id: defaults['sms_setting.tencent_sdk_app_id'],
    tencent_sign_name: defaults['sms_setting.tencent_sign_name'],
    tencent_template_id: defaults['sms_setting.tencent_template_id'],
    tencent_region: defaults['sms_setting.tencent_region'],
  },
})

export function SmsSettingsSection({ defaultValues }: SmsSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const baselineRef = useRef<SmsSettingsSectionProps['defaultValues']>(
    defaultValues
  )

  const formDefaults = useMemo(
    () => buildFormDefaults(defaultValues),
    [defaultValues]
  )

  const form = useForm<SmsFormInput, unknown, SmsFormValues>({
    resolver: zodResolver(smsSchema),
    defaultValues: formDefaults,
  })

  useResetForm(form, formDefaults)

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('sms_setting.enabled')
  const provider = form.watch('sms_setting.provider')

  async function onSubmit(values: SmsFormValues) {
    const settings = values.sms_setting
    const updates: Array<{ key: string; value: string }> = []

    if (settings.enabled !== baselineRef.current['sms_setting.enabled']) {
      updates.push({
        key: 'sms_setting.enabled',
        value: String(settings.enabled),
      })
    }
    if (settings.provider !== baselineRef.current['sms_setting.provider']) {
      updates.push({ key: 'sms_setting.provider', value: settings.provider })
    }
    for (const field of STRING_FIELDS) {
      const value = settings[field]
      if (value !== baselineRef.current[`sms_setting.${field}`]) {
        updates.push({ key: `sms_setting.${field}`, value })
      }
    }
    for (const field of SECRET_FIELDS) {
      const value = settings[field].trim()
      if (value !== '') {
        updates.push({ key: `sms_setting.${field}`, value })
      }
    }

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }

    // 把已应用的更新并入基线，保存后表单回到干净状态
    const applied: Record<string, unknown> = {}
    for (const update of updates) {
      if (update.key === 'sms_setting.enabled') {
        applied['sms_setting.enabled'] = settings.enabled
      } else if (update.key === 'sms_setting.provider') {
        applied['sms_setting.provider'] = settings.provider
      } else {
        applied[update.key] = update.value
      }
    }
    baselineRef.current = { ...baselineRef.current, ...applied }
    form.reset(buildFormDefaults(baselineRef.current))
  }

  return (
    <SettingsSection title={t('SMS Settings')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel='Save SMS settings'
          />
          <FormField
            control={form.control}
            name='sms_setting.enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable phone number login')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Allow users to sign in or register with an SMS verification code'
                    )}
                  </FormDescription>
                </SettingsSwitchContent>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={updateOption.isPending || isSubmitting}
                  />
                </FormControl>
              </SettingsSwitchItem>
            )}
          />

          {enabled && (
            <>
              <FormField
                control={form.control}
                name='sms_setting.provider'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('SMS provider')}</FormLabel>
                    <FormControl>
                      <Select
                        items={[
                          { value: 'aliyun', label: t('Alibaba Cloud SMS') },
                          { value: 'tencent', label: t('Tencent Cloud SMS') },
                          { value: 'debug', label: t('Debug (print code to server log)') },
                        ]}
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            <SelectItem value='aliyun'>
                              {t('Alibaba Cloud SMS')}
                            </SelectItem>
                            <SelectItem value='tencent'>
                              {t('Tencent Cloud SMS')}
                            </SelectItem>
                            <SelectItem value='debug'>
                              {t('Debug (print code to server log)')}
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {provider === 'debug' && (
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'Debug mode does not send real SMS. The verification code is printed to the server log, for local testing only.'
                  )}
                </p>
              )}

              {provider === 'aliyun' && (
                <div className='grid gap-6 sm:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='sms_setting.aliyun_access_key_id'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>AccessKey ID</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            autoComplete='off'
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='sms_setting.aliyun_access_secret'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>AccessKey Secret</FormLabel>
                        <FormControl>
                          <PasswordInput
                            {...field}
                            autoComplete='off'
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('Leave blank to keep the current secret')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='sms_setting.aliyun_sign_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('SMS signature')}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            autoComplete='off'
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='sms_setting.aliyun_template_code'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Template code')}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            autoComplete='off'
                            disabled={isSubmitting}
                            placeholder='SMS_123456789'
                          />
                        </FormControl>
                        <FormDescription>
                          {t(
                            'The template must contain a variable used as the verification code'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {provider === 'tencent' && (
                <div className='grid gap-6 sm:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='sms_setting.tencent_secret_id'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SecretId</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            autoComplete='off'
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='sms_setting.tencent_secret'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SecretKey</FormLabel>
                        <FormControl>
                          <PasswordInput
                            {...field}
                            autoComplete='off'
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('Leave blank to keep the current secret')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='sms_setting.tencent_sdk_app_id'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SdkAppId</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            autoComplete='off'
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='sms_setting.tencent_sign_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('SMS signature')}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            autoComplete='off'
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='sms_setting.tencent_template_id'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Template ID')}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            autoComplete='off'
                            disabled={isSubmitting}
                            placeholder='1234567'
                          />
                        </FormControl>
                        <FormDescription>
                          {t(
                            'The template must contain a variable used as the verification code'
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='sms_setting.tencent_region'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Region')}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            autoComplete='off'
                            disabled={isSubmitting}
                            placeholder='ap-guangzhou'
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
