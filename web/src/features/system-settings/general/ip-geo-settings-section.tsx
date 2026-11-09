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
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
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

const IP_PLACEHOLDER = '{ip}'

// 与后端 setting/ip_geo_setting 的内置解析器一一对应
const PROVIDER_TYPE_OPTIONS = [
  {
    value: 'ip_api',
    labelKey: 'ip-api.com format (status/country/regionName/city/isp)',
  },
  {
    value: 'ip_sb',
    labelKey: 'ip.sb format (country/region/city/organization)',
  },
  { value: 'baidu', labelKey: 'Baidu OpenData format (data[0].location)' },
] as const

type ProviderRow = {
  /** 行编辑用的内部稳定 id，不参与保存 */
  rowId: number
  name: string
  url_template: string
  type: string
  enabled: boolean
}

type FormValues = {
  enabled: boolean
  timeout: string | number
}

let nextRowId = 1

const schema = (t: (key: string) => string) =>
  z.object({
    enabled: z.boolean(),
    timeout: z.coerce
      .number()
      .int(t('Timeout must be an integer'))
      .min(1, t('Timeout must be at least 1 second'))
      .max(30, t('Timeout must be at most 30 seconds')),
  })

function parseProviders(settingsProviders: string): ProviderRow[] {
  try {
    const parsed = JSON.parse(settingsProviders) as Omit<ProviderRow, 'rowId'>[]
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.map((row) => ({
      rowId: nextRowId++,
      name: typeof row.name === 'string' ? row.name : '',
      url_template:
        typeof row.url_template === 'string' ? row.url_template : '',
      type: typeof row.type === 'string' ? row.type : 'ip_api',
      enabled: Boolean(row.enabled),
    }))
  } catch {
    return []
  }
}

export function IpGeoSettingsSection({
  defaultValues,
}: {
  defaultValues: {
    enabled: boolean
    providers: string
    timeoutSeconds: number
  }
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const [rows, setRows] = useState<ProviderRow[]>(() =>
    parseProviders(defaultValues.providers)
  )
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({})

  const form = useForm<
    FormValues,
    unknown,
    { enabled: boolean; timeout: number }
  >({
    resolver: zodResolver(schema(t)) as unknown as Resolver<
      FormValues,
      unknown,
      { enabled: boolean; timeout: number }
    >,
    defaultValues: {
      enabled: defaultValues.enabled,
      timeout: defaultValues.timeoutSeconds,
    },
  })

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')

  function updateRow(index: number, patch: Partial<ProviderRow>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
    setRowErrors((prev) => {
      if (!prev[index]) {
        return prev
      }
      const next = { ...prev }
      delete next[index]
      return next
    })
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        rowId: nextRowId++,
        name: '',
        url_template: '',
        type: 'ip_api',
        enabled: true,
      },
    ])
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
    setRowErrors((prev) => {
      const next: Record<number, string> = {}
      for (const [key, value] of Object.entries(prev)) {
        const idx = Number(key)
        if (idx < index) {
          next[idx] = value
        } else if (idx > index) {
          next[idx - 1] = value
        }
      }
      return next
    })
  }

  function validateRows(): boolean {
    const errors: Record<number, string> = {}
    rows.forEach((row, index) => {
      if (!row.url_template.includes(IP_PLACEHOLDER)) {
        errors[index] = t('URL template must contain {ip} placeholder')
      }
    })
    setRowErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function onSubmit(values: { enabled: boolean; timeout: number }) {
    if (values.enabled && rows.length > 0 && !validateRows()) {
      toast.error(t('Fix provider errors before saving'))
      return
    }

    const updates: Array<{ key: string; value: string }> = []
    if (values.enabled !== defaultValues.enabled) {
      updates.push({
        key: 'ip_geo_setting.enabled',
        value: String(values.enabled),
      })
    }
    if (values.timeout !== defaultValues.timeoutSeconds) {
      updates.push({
        key: 'ip_geo_setting.timeout_seconds',
        value: String(values.timeout),
      })
    }
    if (
      JSON.stringify(rows) !==
      JSON.stringify(parseProviders(defaultValues.providers))
    ) {
      updates.push({
        key: 'ip_geo_setting.providers',
        value: JSON.stringify(rows),
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
      timeout: values.timeout,
    })
    setRows(rows.map((row) => ({ ...row })))
  }

  return (
    <SettingsSection title={t('IP Geo Lookup Settings')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending || isSubmitting}
            isSaveDisabled={
              !isDirty &&
              rows.every(
                (row, index) =>
                  JSON.stringify(row) ===
                  JSON.stringify(parseProviders(defaultValues.providers)[index])
              )
            }
            saveLabel='Save IP geo settings'
          />
          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable IP geo lookup')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Look up the location of anonymous visitor IPs for the Daily Visits page via external query providers, with automatic prefetching and caching'
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
                name='timeout'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Request timeout (seconds)')}</FormLabel>
                    <FormControl>
                      <Input type='number' min={1} max={30} {...field} />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Timeout for a single provider request; providers are tried in order until one succeeds'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='space-y-3'>
                <div className='flex items-center justify-between'>
                  <FormLabel>{t('Query providers')}</FormLabel>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={addRow}
                  >
                    <Plus aria-hidden className='size-4' />
                    {t('Add provider')}
                  </Button>
                </div>
                <p className='text-muted-foreground text-xs leading-relaxed'>
                  {t(
                    'Providers are tried in order until one succeeds; results are cached for 7 days and failures for 10 minutes'
                  )}
                </p>
                {rows.length === 0 ? (
                  <p className='text-muted-foreground text-sm'>
                    {t('No providers configured')}
                  </p>
                ) : (
                  <div className='space-y-3'>
                    {rows.map((row, index) => (
                      <div
                        key={row.rowId}
                        className='border-border/60 bg-card/50 space-y-2.5 rounded-lg border p-3'
                      >
                        <div className='grid gap-2.5 sm:grid-cols-[1fr_1fr_auto]'>
                          <Input
                            value={row.name}
                            onChange={(e) =>
                              updateRow(index, { name: e.target.value })
                            }
                            placeholder={t('Display name')}
                            aria-label={t('Provider display name')}
                          />
                          <Select
                            value={row.type}
                            onValueChange={(value) =>
                              updateRow(index, { type: value })
                            }
                          >
                            <SelectTrigger aria-label={t('Response format')}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PROVIDER_TYPE_OPTIONS.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {t(option.labelKey)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            onClick={() => removeRow(index)}
                            aria-label={t('Remove provider')}
                          >
                            <Trash2 aria-hidden className='size-4' />
                          </Button>
                        </div>
                        <Input
                          value={row.url_template}
                          onChange={(e) =>
                            updateRow(index, { url_template: e.target.value })
                          }
                          placeholder='https://example.com/api/{ip}'
                          aria-label={t('Provider URL template')}
                        />
                        {rowErrors[index] ? (
                          <p className='text-destructive text-xs'>
                            {rowErrors[index]}
                          </p>
                        ) : null}
                        <label className='flex items-center gap-2 text-sm'>
                          <Switch
                            checked={row.enabled}
                            onCheckedChange={(checked) =>
                              updateRow(index, { enabled: checked })
                            }
                            aria-label={t('Enable provider')}
                          />
                          {t('Enable this provider')}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
