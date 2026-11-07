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
import { Loader2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Combobox } from '@/components/ui/combobox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getCurrencyDisplay } from '@/lib/currency'

import type { OfficialPriceCandidate, OfficialPriceSyncReport } from '../types'

// (provider, model_name) 唯一确定 models.dev 上的一个候选;组合成下拉 value。
// provider 不含 "|",model_name 极少含,解析时用 lastIndexOf 兜底。
export const NONE_MAPPING_VALUE = '__none__'

export function officialPriceCandidateKey(candidate: {
  provider: string
  model_name: string
}): string {
  return `${candidate.provider}|${candidate.model_name}`
}

export function parseOfficialPriceCandidateKey(
  key: string
): { provider: string; model_name: string } | null {
  const idx = key.lastIndexOf('|')
  if (idx <= 0 || idx === key.length - 1) return null
  return { provider: key.slice(0, idx), model_name: key.slice(idx + 1) }
}

// 候选提示按官方价美元汇率折算成展示货币,与前台官方价口径一致
function candidatePriceHint(
  candidate: OfficialPriceCandidate,
  exchangeRate: number,
  symbol: string
): string {
  const input = `${symbol}${round6(candidate.input * exchangeRate)}`
  const output =
    candidate.output != null
      ? `${symbol}${round6(candidate.output * exchangeRate)}`
      : '-'
  return `${input} → ${output} / 1M`
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

type OfficialPriceSyncDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  report: OfficialPriceSyncReport | null
  mappings: Record<string, string | null>
  onMappingChange: (siteModel: string, key: string | null) => void
  selected: Record<string, boolean>
  onSelectionChange: (siteModel: string, checked: boolean) => void
  onConfirm: () => void
  applying: boolean
  exchangeRate: number
}

export function OfficialPriceSyncDialog(props: OfficialPriceSyncDialogProps) {
  const { t } = useTranslation()
  const { report, mappings, selected } = props
  const currencySymbol = useMemo(() => {
    const { meta } = getCurrencyDisplay()
    return meta.kind === 'tokens' ? '$' : meta.symbol
  }, [])

  const globalOptions = useMemo(() => {
    if (!report) return []
    return report.candidates.map((candidate) => ({
      value: officialPriceCandidateKey(candidate),
      label: `${candidate.model_name} (${candidate.provider})`,
      description: candidatePriceHint(
        candidate,
        props.exchangeRate,
        currencySymbol
      ),
    }))
  }, [report, props.exchangeRate, currencySymbol])

  const summary = useMemo(() => {
    if (!report) return { auto: 0, ambiguous: 0, unmatched: 0, manual: 0 }
    let auto = 0
    let ambiguous = 0
    let unmatched = 0
    let manual = 0
    for (const model of report.models) {
      // 后端旧版本对未匹配模型会把 options 序列化成 null,容错为空数组
      const options = model.options ?? []
      if (options.length === 0) unmatched += 1
      else if (options.length > 1) ambiguous += 1
      else auto += 1
      if (model.existing_source === 'manual') manual += 1
    }
    return { auto, ambiguous, unmatched, manual }
  }, [report])

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  )

  const allSelected =
    !!report &&
    report.models.length > 0 &&
    selectedCount === report.models.length

  const handleToggleAll = () => {
    if (!report) return
    // 整体勾选/取消:通过逐个回调,让父级状态保持单一来源
    for (const model of report.models) {
      props.onSelectionChange(model.site_model, !allSelected)
    }
  }

  const renderRowOptions = (
    options: OfficialPriceCandidate[],
    allowNone: boolean
  ) => {
    const list = options.map((candidate) => ({
      value: officialPriceCandidateKey(candidate),
      label: `${candidate.model_name} (${candidate.provider})`,
      description: candidatePriceHint(
        candidate,
        props.exchangeRate,
        currencySymbol
      ),
    }))
    if (allowNone && list.length > 0) {
      list.unshift({
        value: NONE_MAPPING_VALUE,
        label: t('None — keep current config'),
      })
    }
    return list
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{t('Official price mapping')}</DialogTitle>
          <DialogDescription>
            {t(
              'Only checked models will be overwritten. Manually edited models are unchecked by default; adjust each mapping before confirming.'
            )}
          </DialogDescription>
        </DialogHeader>

        {report && (
          <>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div className='text-muted-foreground text-sm'>
                {t(
                  '{{auto}} auto-mapped, {{ambiguous}} with multiple candidates, {{unmatched}} unmatched',
                  summary
                )}
                {summary.manual > 0 &&
                  ` · ${t('{{count}} manually edited', { count: summary.manual })}`}
              </div>
              <label className='text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs whitespace-nowrap'>
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) => {
                    if (checked === 'indeterminate') return
                    handleToggleAll()
                  }}
                  aria-label={t('Select all')}
                />
                {t('Select all')}
              </label>
            </div>

            <div className='max-h-[50vh] space-y-1.5 overflow-y-auto pr-1'>
              {report.models.map((model) => {
                const value = mappings[model.site_model] ?? ''
                const manuallyEdited = model.existing_source === 'manual'
                // 后端旧版本对未匹配模型会把 options 序列化成 null,容错为空数组
                const options = model.options ?? []
                return (
                  <div
                    key={model.site_model}
                    className='flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5'
                  >
                    <Checkbox
                      checked={!!selected[model.site_model]}
                      onCheckedChange={(checked) => {
                        if (checked === 'indeterminate') return
                        props.onSelectionChange(model.site_model, checked)
                      }}
                      aria-label={t('Sync {{model}}', {
                        model: model.site_model,
                      })}
                    />
                    <span className='font-mono text-xs break-all'>
                      {model.site_model}
                    </span>
                    {manuallyEdited && (
                      <Badge
                        variant='outline'
                        className='border-blue-500 text-blue-600 dark:text-blue-400'
                      >
                        {t('Manually edited')}
                      </Badge>
                    )}
                    {options.length === 0 ? (
                      <Badge variant='outline'>{t('Unmatched')}</Badge>
                    ) : options.length > 1 ? (
                      <Badge
                        variant='outline'
                        className='border-amber-500 text-amber-600 dark:text-amber-400'
                      >
                        {t('{{count}} candidates', {
                          count: options.length,
                        })}
                      </Badge>
                    ) : (
                      <Badge variant='secondary'>{t('Auto-mapped')}</Badge>
                    )}
                    <div className='min-w-52 flex-1'>
                      <Combobox
                        options={
                          options.length === 0
                            ? globalOptions
                            : renderRowOptions(options, true)
                        }
                        value={value}
                        onValueChange={(next) =>
                          props.onMappingChange(
                            model.site_model,
                            !next || next === NONE_MAPPING_VALUE ? null : next
                          )
                        }
                        placeholder={t('Select official model')}
                        searchPlaceholder={t('Search official models')}
                        emptyText={t('No matching official model')}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
            disabled={props.applying}
          >
            {t('Cancel')}
          </Button>
          <Button
            onClick={props.onConfirm}
            disabled={props.applying || selectedCount === 0}
          >
            {props.applying && <Loader2 className='size-4 animate-spin' />}
            {t('Confirm sync ({{count}})', { count: selectedCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
