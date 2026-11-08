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
import { Textarea } from '@/components/ui/textarea'

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const contextGuardSchema = z.object({
  ContextLengthGuardMaxTokens: z.number().min(0),
  ContextLengthGuardIdleMinutes: z.number().min(0).max(1440),
  ContextLengthGuardExemptLimit: z.number().min(0).max(10000),
  ContextLengthGuardMessage: z.string(),
})

type ContextGuardFormValues = z.output<typeof contextGuardSchema>
type ContextGuardFormInput = z.input<typeof contextGuardSchema>

type NormalizedContextGuardValues = {
  ContextLengthGuardMaxTokens: number
  ContextLengthGuardIdleMinutes: number
  ContextLengthGuardExemptLimit: number
  ContextLengthGuardMessage: string
}

type ContextGuardSectionProps = {
  defaultValues: NormalizedContextGuardValues
}

const buildFormDefaults = (
  defaults: ContextGuardSectionProps['defaultValues']
): ContextGuardFormInput => ({
  ContextLengthGuardMaxTokens: defaults.ContextLengthGuardMaxTokens,
  ContextLengthGuardIdleMinutes: defaults.ContextLengthGuardIdleMinutes,
  ContextLengthGuardExemptLimit: defaults.ContextLengthGuardExemptLimit,
  ContextLengthGuardMessage: defaults.ContextLengthGuardMessage,
})

const normalizeFormValues = (
  values: ContextGuardFormValues
): NormalizedContextGuardValues => ({
  ContextLengthGuardMaxTokens: values.ContextLengthGuardMaxTokens,
  ContextLengthGuardIdleMinutes: values.ContextLengthGuardIdleMinutes,
  ContextLengthGuardExemptLimit: values.ContextLengthGuardExemptLimit,
  ContextLengthGuardMessage: values.ContextLengthGuardMessage,
})

export function ContextGuardSection({
  defaultValues,
}: ContextGuardSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const form = useForm<ContextGuardFormInput, unknown, ContextGuardFormValues>({
    resolver: zodResolver(contextGuardSchema),
    mode: 'onChange',
    defaultValues: buildFormDefaults(defaultValues),
  })

  useEffect(() => {
    form.reset(buildFormDefaults(defaultValues))
  }, [defaultValues, form])

  const onSubmit = async (values: ContextGuardFormValues) => {
    const normalized = normalizeFormValues(values)
    for (const key of [
      'ContextLengthGuardMaxTokens',
      'ContextLengthGuardIdleMinutes',
      'ContextLengthGuardExemptLimit',
      'ContextLengthGuardMessage',
    ] as const) {
      if (normalized[key] !== defaultValues[key]) {
        await updateOption.mutateAsync({ key, value: normalized[key] })
      }
    }
  }

  return (
    <SettingsSection title={t('Context Length Guard')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save context guard settings'
          />
          <FormField
            control={form.control}
            name='ContextLengthGuardMaxTokens'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Input token limit')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    step={1}
                    {...field}
                    onChange={(e) =>
                      field.onChange(Number.parseInt(e.target.value) || 0)
                    }
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Block requests whose estimated input tokens exceed this limit and reply with guidance to run /compact. 0 disables the guard.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='ContextLengthGuardIdleMinutes'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Active session window (minutes)')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    step={1}
                    {...field}
                    onChange={(e) =>
                      field.onChange(Number.parseInt(e.target.value) || 0)
                    }
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Requests from a user within this window are treated as an ongoing task and allowed even over the limit, so long-running jobs are not interrupted. Oversized requests blocked on a cold start also refresh this window, so the follow-up /compact request goes through.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='ContextLengthGuardExemptLimit'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Consecutive exempt limit')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={0}
                    step={1}
                    {...field}
                    onChange={(e) =>
                      field.onChange(Number.parseInt(e.target.value) || 0)
                    }
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Max consecutive oversized requests allowed within the active window. Once reached, the user is blocked even mid-session and must run /compact; a request under the limit resets the count. 0 means unlimited (active window only).'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='ContextLengthGuardMessage'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Custom block message')}</FormLabel>
                <FormControl>
                  <Textarea rows={4} {...field} />
                </FormControl>
                <FormDescription>
                  {t('Leave empty to use the built-in message.')}{' '}
                  {t('Placeholders:')}{' '}
                  <code>{'{{.Tokens}}'}</code> / <code>{'{{.Max}}'}</code>.{' '}
                  {t('Invalid templates fall back to the built-in message.')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
