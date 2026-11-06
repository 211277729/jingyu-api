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
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

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
import { Switch } from '@/components/ui/switch'
import { parseQuotaFromDollars, quotaUnitsToDollars } from '@/lib/format'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

// 代理佣金按客户到账 quota 的百分比计算；二级佣金只发给「也是代理」的上级
const schema = (t: (key: string) => string) =>
  z.object({
    enabled: z.boolean(),
    firstPercent: z.coerce
      .number()
      .min(0, t('Rebate percentage cannot be negative'))
      .max(100, t('Rebate percentage cannot exceed 100')),
    percent: z.coerce
      .number()
      .min(0, t('Rebate percentage cannot be negative'))
      .max(100, t('Rebate percentage cannot exceed 100')),
    secondPercent: z.coerce
      .number()
      .min(0, t('Rebate percentage cannot be negative'))
      .max(100, t('Rebate percentage cannot exceed 100')),
    firstDays: z.coerce
      .number()
      .int(t('Days must be a whole number'))
      .min(0, t('Days cannot be negative')),
    minWithdraw: z.coerce.number().min(0, t('Amount cannot be negative')),
  })

type FormValues = {
  enabled: boolean
  firstPercent: string | number
  percent: string | number
  secondPercent: string | number
  firstDays: string | number
  minWithdraw: string | number
}
type ParsedValues = {
  enabled: boolean
  firstPercent: number
  percent: number
  secondPercent: number
  firstDays: number
  minWithdraw: number
}

export function AgentDistributionSettingsSection({
  defaultValues,
}: {
  defaultValues: {
    enabled: boolean
    firstPercent: number
    percent: number
    secondPercent: number
    firstDays: number
    minWithdrawQuotaUnits: number
  }
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const form = useForm<FormValues, unknown, ParsedValues>({
    resolver: zodResolver(schema(t)) as unknown as Resolver<
      FormValues,
      unknown,
      ParsedValues
    >,
    defaultValues: {
      enabled: defaultValues.enabled,
      firstPercent: formatPercent(defaultValues.firstPercent),
      percent: formatPercent(defaultValues.percent),
      secondPercent: formatPercent(defaultValues.secondPercent),
      firstDays: defaultValues.firstDays,
      minWithdraw: quotaUnitsToDollars(
        defaultValues.minWithdrawQuotaUnits
      ).toFixed(2),
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')

  async function onSubmit(values: ParsedValues) {
    const updates: Array<{ key: string; value: string }> = []

    if (values.enabled !== defaultValues.enabled) {
      updates.push({
        key: 'agent_setting.enabled',
        value: String(values.enabled),
      })
    }
    if (values.firstPercent !== defaultValues.firstPercent) {
      updates.push({
        key: 'agent_setting.first_percent',
        value: String(values.firstPercent),
      })
    }
    if (values.percent !== defaultValues.percent) {
      updates.push({
        key: 'agent_setting.percent',
        value: String(values.percent),
      })
    }
    if (values.secondPercent !== defaultValues.secondPercent) {
      updates.push({
        key: 'agent_setting.second_percent',
        value: String(values.secondPercent),
      })
    }
    if (values.firstDays !== defaultValues.firstDays) {
      updates.push({
        key: 'agent_setting.first_days',
        value: String(values.firstDays),
      })
    }
    const minWithdrawQuota = parseQuotaFromDollars(values.minWithdraw)
    if (minWithdrawQuota !== defaultValues.minWithdrawQuotaUnits) {
      updates.push({
        key: 'agent_setting.min_withdraw_quota',
        value: String(minWithdrawQuota),
      })
    }

    if (updates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }

    form.reset({
      enabled: values.enabled,
      firstPercent: formatPercent(values.firstPercent),
      percent: formatPercent(values.percent),
      secondPercent: formatPercent(values.secondPercent),
      firstDays: values.firstDays,
      minWithdraw: values.minWithdraw,
    })
    toast.success(t('Settings saved successfully'))
  }

  return (
    <SettingsSection title={t('Agent Distribution')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel='Save agent distribution settings'
          />
          <p className='text-muted-foreground text-sm'>
            {t(
              'Customers who sign up through an approved agent’s invite link belong to that agent permanently. Their top-ups earn the agent commission in agent_quota, which agents can request to withdraw (settled manually via red envelope). At most two levels: an agent’s own inviter also earns the second-level commission if they are an approved agent.'
            )}
          </p>

          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable agent distribution')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Allow users to apply as agents and earn withdrawal-able commission from their customers'
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
            <div className='grid gap-6 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='firstPercent'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('Agent first top-up commission (%)')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        max={100}
                        step={0.1}
                        placeholder='20'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Percentage of the customer’s first top-up credited to the agent; 0 disables it'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='percent'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Agent recurring commission (%)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        max={100}
                        step={0.1}
                        placeholder='10'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Percentage of every later top-up credited to the agent; 0 disables it'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='secondPercent'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Second-level commission (%)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        max={100}
                        step={0.1}
                        placeholder='5'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Percentage also credited to the agent’s inviter when they are an approved agent; 0 disables it'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='firstDays'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('First top-up window (days)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        step={1}
                        placeholder='0'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Only a first top-up made within this many days after registration earns the first top-up commission; 0 means no limit'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='minWithdraw'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Minimum withdrawal amount ($)')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        step={0.01}
                        placeholder='1.00'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Minimum commission balance an agent needs to request a withdrawal; 0 means no limit'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}

/** Trim trailing zeros so 10.0 renders as 10 and 12.5 keeps its decimal. */
function formatPercent(value: number): string {
  return String(Number(value.toFixed(2)))
}
