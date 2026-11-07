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
import type { ChangeEvent } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Alert, AlertDescription } from '@/components/ui/alert'
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
  formatAmountInput,
  parseQuotaFromDollars,
  quotaUnitsToDollars,
} from '@/lib/format'

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

// 返利比例按好友到账 quota 的百分比计算，首笔比例受注册天数窗口限制（0 = 不限制）
const schema = (t: (key: string) => string) =>
  z.object({
    firstPercent: z.coerce
      .number()
      .min(0, t('Rebate percentage cannot be negative'))
      .max(100, t('Rebate percentage cannot exceed 100')),
    percent: z.coerce
      .number()
      .min(0, t('Rebate percentage cannot be negative'))
      .max(100, t('Rebate percentage cannot exceed 100')),
    firstDays: z.coerce
      .number()
      .int(t('Days must be a whole number'))
      .min(0, t('Days cannot be negative')),
    QuotaForInviter: z.coerce.number().min(0),
    QuotaForInvitee: z.coerce.number().min(0),
  })

type QuotaInputValue = number | ''
type FormValues = {
  firstPercent: string | number
  percent: string | number
  firstDays: string | number
  QuotaForInviter: QuotaInputValue
  QuotaForInvitee: QuotaInputValue
}
type ParsedValues = {
  firstPercent: number
  percent: number
  firstDays: number
  QuotaForInviter: number
  QuotaForInvitee: number
}

export function AffRebateSettingsSection({
  defaultValues,
  complianceConfirmed = true,
}: {
  defaultValues: {
    firstPercent: number
    percent: number
    firstDays: number
    // 以下两个字段为原始 quota 整数；表单内部以货币金额表示
    QuotaForInviter: number
    QuotaForInvitee: number
  }
  complianceConfirmed?: boolean
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const handleNumberChange =
    (onChange: (value: QuotaInputValue) => void) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.currentTarget.valueAsNumber
      onChange(Number.isNaN(value) ? '' : value)
    }

  const form = useForm<FormValues, unknown, ParsedValues>({
    resolver: zodResolver(schema(t)) as unknown as Resolver<
      FormValues,
      unknown,
      ParsedValues
    >,
    defaultValues: {
      firstPercent: formatPercent(defaultValues.firstPercent),
      percent: formatPercent(defaultValues.percent),
      firstDays: defaultValues.firstDays,
      QuotaForInviter: quotaUnitsToDollars(defaultValues.QuotaForInviter),
      QuotaForInvitee: quotaUnitsToDollars(defaultValues.QuotaForInvitee),
    },
  })

  const { isDirty, isSubmitting } = form.formState

  async function onSubmit(values: ParsedValues) {
    const updates: Array<{ key: string; value: string }> = []

    if (values.firstPercent !== defaultValues.firstPercent) {
      updates.push({
        key: 'aff_rebate_setting.first_percent',
        value: String(values.firstPercent),
      })
    }
    if (values.percent !== defaultValues.percent) {
      updates.push({
        key: 'aff_rebate_setting.percent',
        value: String(values.percent),
      })
    }
    if (values.firstDays !== defaultValues.firstDays) {
      updates.push({
        key: 'aff_rebate_setting.first_days',
        value: String(values.firstDays),
      })
    }
    if (
      values.QuotaForInviter !==
      quotaUnitsToDollars(defaultValues.QuotaForInviter)
    ) {
      updates.push({
        key: 'QuotaForInviter',
        value: String(parseQuotaFromDollars(values.QuotaForInviter)),
      })
    }
    if (
      values.QuotaForInvitee !==
      quotaUnitsToDollars(defaultValues.QuotaForInvitee)
    ) {
      updates.push({
        key: 'QuotaForInvitee',
        value: String(parseQuotaFromDollars(values.QuotaForInvitee)),
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
      firstPercent: formatPercent(values.firstPercent),
      percent: formatPercent(values.percent),
      firstDays: values.firstDays,
      QuotaForInviter: values.QuotaForInviter,
      QuotaForInvitee: values.QuotaForInvitee,
    })
    toast.success(t('Settings saved successfully'))
  }

  return (
    <SettingsSection title={t('Invite Rewards')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={!isDirty}
            saveLabel='Save invite reward settings'
          />
          {!complianceConfirmed ? (
            <Alert variant='destructive'>
              <AlertDescription>
                {t(
                  'Non-zero invitation rewards require compliance confirmation in Payment Gateway settings.'
                )}
              </AlertDescription>
            </Alert>
          ) : null}
          <p className='text-muted-foreground text-sm'>
            {t(
              'When a friend tops up (online payment or redemption code), the inviter earns a percentage of the credited amount as pending rewards. Set a percentage to 0 to disable it.'
            )}
          </p>

          <div className='grid gap-6 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='firstPercent'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('First top-up rebate (%)')}</FormLabel>
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
                      'Percentage of the friend’s first top-up credited to the inviter’s pending rewards; 0 disables it'
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
                  <FormLabel>{t('Recurring top-up rebate (%)')}</FormLabel>
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
                      'Percentage of every later top-up credited to the inviter’s pending rewards; 0 disables it'
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
                      'Only a first top-up made within this many days after registration earns the first top-up rebate; 0 means no limit'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid gap-6 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='QuotaForInviter'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Inviter Reward')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      step='0.01'
                      value={formatAmountInput(field.value)}
                      onChange={handleNumberChange(field.onChange)}
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Actual amount given to users who invite others (0 disables)'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='QuotaForInvitee'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Invitee Reward')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      step='0.01'
                      value={formatAmountInput(field.value)}
                      onChange={handleNumberChange(field.onChange)}
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Actual amount given to invited users (0 disables)')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}

/** Trim trailing zeros so 10.0 renders as 10 and 12.5 keeps its decimal. */
function formatPercent(value: number): string {
  return String(Number(value.toFixed(2)))
}
