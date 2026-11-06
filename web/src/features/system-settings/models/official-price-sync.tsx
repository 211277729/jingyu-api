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
import { useMutation } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { getCurrencyDisplay } from '@/lib/currency'
import { handleServerError } from '@/lib/handle-server-error'

import {
  applyOfficialPrice,
  getOfficialPriceConfig,
  syncOfficialPrice,
  updateOfficialPriceConfig,
  updateOfficialPriceExchangeRate,
} from '../api'
import type {
  OfficialPriceEntry,
  OfficialPriceMappingRef,
  OfficialPriceSyncReport,
} from '../types'
import {
  OfficialPriceSyncDialog,
  officialPriceCandidateKey,
} from './official-price-sync-dialog'

const USD_RATIO_DIVISOR = 2 // 1 ratio unit = $0.002 / 1K tokens

// 与后端 ratio_setting.DefaultOfficialPriceExchangeRate 保持一致
const DEFAULT_EXCHANGE_RATE = 7.3

function ratioToUsdPerMillion(ratio: number): number {
  return ratio * USD_RATIO_DIVISOR
}

function entryToUsdValues(entry: OfficialPriceEntry) {
  const input = ratioToUsdPerMillion(entry.model_ratio)
  const peakInput =
    entry.peak_model_ratio && entry.peak_model_ratio > 0
      ? ratioToUsdPerMillion(entry.peak_model_ratio)
      : null
  return {
    input,
    output: entry.completion_ratio * input,
    cacheRead: entry.cache_ratio != null ? entry.cache_ratio * input : null,
    peakInput,
    peakOutput:
      peakInput != null && entry.peak_completion_ratio
        ? entry.peak_completion_ratio * peakInput
        : null,
    peakCacheRead:
      peakInput != null && entry.peak_cache_ratio != null
        ? entry.peak_cache_ratio * peakInput
        : null,
  }
}

// 由三个 USD/1M 单价反推展示倍率(与同步换算公式互逆)
function usdValuesToEntry(
  base: OfficialPriceEntry,
  usd: { input: number; output: number; cacheRead: number | null }
): OfficialPriceEntry {
  const input = usd.input >= 0 ? usd.input : 0
  return {
    ...base,
    model_ratio: input / USD_RATIO_DIVISOR,
    completion_ratio: input > 0 && usd.output > 0 ? usd.output / input : 0,
    cache_ratio:
      input > 0 && usd.cacheRead != null && usd.cacheRead >= 0
        ? usd.cacheRead / input
        : null,
  }
}

// 高峰价编辑:只改高峰字段;高峰输入价清空/归零表示删除高峰价
function applyPeakUsdValues(
  base: OfficialPriceEntry,
  peak: {
    input: number | null
    output: number | null
    cacheRead: number | null
  }
): OfficialPriceEntry {
  const peakInput = peak.input != null && peak.input > 0 ? peak.input : null
  const next: OfficialPriceEntry = { ...base }
  if (peakInput == null) {
    // 高峰输入价清空 = 移除高峰价整组字段
    delete next.peak_model_ratio
    delete next.peak_completion_ratio
    delete next.peak_cache_ratio
    return next
  }
  next.peak_model_ratio = peakInput / USD_RATIO_DIVISOR
  next.peak_completion_ratio =
    peak.output != null && peak.output > 0 ? peak.output / peakInput : 0
  next.peak_cache_ratio =
    peak.cacheRead != null && peak.cacheRead >= 0
      ? peak.cacheRead / peakInput
      : null
  return next
}

function roundTo6(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

// 管理端展示/编辑货币符号(站点显示货币;TOKENS 视作 $ 与计费口径一致)
function getDisplayCurrencySymbol(): string {
  const { meta } = getCurrencyDisplay()
  return meta.kind === 'tokens' ? '$' : meta.symbol
}

export function OfficialPriceSync() {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<Record<string, OfficialPriceEntry>>({})
  const [entriesLoaded, setEntriesLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [exchangeRate, setExchangeRate] = useState(DEFAULT_EXCHANGE_RATE)
  const [rateInputNonce, setRateInputNonce] = useState(0)

  // 同步弹框状态:预览报告 + 弹框内的人工映射(siteModel -> "provider|model_name")
  // + 勾选(只同步勾选的模型;人工修改过的默认不勾选)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [syncReport, setSyncReport] = useState<OfficialPriceSyncReport | null>(
    null
  )
  const [mappings, setMappings] = useState<Record<string, string | null>>({})
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const loadEntries = useCallback(async () => {
    try {
      const res = await getOfficialPriceConfig()
      setEntries(res.data?.entries ?? {})
      setExchangeRate(res.data?.exchange_rate ?? DEFAULT_EXCHANGE_RATE)
      setEntriesLoaded(true)
    } catch (error) {
      handleServerError(error, t('Failed to load official price config'))
    }
  }, [t])

  // 进入页面自动加载当前配置,无需手动点击
  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  const syncMutation = useMutation({
    mutationFn: syncOfficialPrice,
    onSuccess: (res) => {
      if (!res.data) return
      setSyncReport(res.data)
      // 默认按「最便宜非零输入价」启发式预选;同名多候选与未匹配模型在弹框中人工确认。
      // 人工修改过的条目(existing_source=manual)默认不勾选,避免同步覆盖人工改过的价。
      const initialMappings: Record<string, string | null> = {}
      const initialSelected: Record<string, boolean> = {}
      for (const model of res.data.models) {
        initialMappings[model.site_model] = model.auto
          ? officialPriceCandidateKey(model.auto)
          : null
        initialSelected[model.site_model] =
          !!model.auto && model.existing_source !== 'manual'
      }
      setMappings(initialMappings)
      setSelected(initialSelected)
      setDialogOpen(true)
    },
    onError: (error) =>
      handleServerError(error, t('Failed to sync official prices')),
  })

  const applyMutation = useMutation({
    mutationFn: (refs: Record<string, OfficialPriceMappingRef>) =>
      applyOfficialPrice(refs),
    onSuccess: (res) => {
      const data = res.data
      if (!data) return
      toast.success(
        t('{{count}} entries applied, {{skipped}} skipped', {
          count: data.applied.length,
          skipped: data.skipped.length,
        })
      )
      setDialogOpen(false)
      setSyncReport(null)
      setMappings({})
      setSelected({})
      void loadEntries()
    },
    onError: (error) =>
      handleServerError(error, t('Failed to apply official price mapping')),
  })

  const saveMutation = useMutation({
    mutationFn: async (next: Record<string, OfficialPriceEntry>) => {
      await updateOfficialPriceConfig(next)
      await loadEntries()
    },
    onSuccess: () => toast.success(t('Official price config saved')),
    onError: (error) =>
      handleServerError(error, t('Failed to save official price config')),
  })

  // 官方价美元汇率:真实 USD -> 展示货币。站点价格是额度口径(本站 1:1),
  // 官方价是真实美元,必须按真实汇率折算两者才可比。
  const rateMutation = useMutation({
    mutationFn: (rate: number) => updateOfficialPriceExchangeRate(rate),
    onSuccess: (res) => {
      if (res.data?.exchange_rate) setExchangeRate(res.data.exchange_rate)
      toast.success(t('Official price exchange rate saved'))
    },
    onError: (error) =>
      handleServerError(
        error,
        t('Failed to save official price exchange rate')
      ),
  })

  const handleExchangeRateBlur = useCallback(
    (raw: string) => {
      const parsed = Number.parseFloat(raw)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        // 非法输入不提交,重挂载输入框回显当前值
        setRateInputNonce((n) => n + 1)
        return
      }
      if (parsed === exchangeRate) return
      rateMutation.mutate(parsed)
    },
    [exchangeRate, rateMutation]
  )

  const entryList = useMemo(() => {
    const list = Object.entries(entries).map(([name, entry]) => ({
      name,
      entry,
    }))
    list.sort((a, b) => a.name.localeCompare(b.name))
    if (!search.trim()) return list
    const q = search.trim().toLowerCase()
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.entry.official_model_name.toLowerCase().includes(q)
    )
  }, [entries, search])

  const handleMappingChange = useCallback(
    (siteModel: string, key: string | null) => {
      setMappings((prev) => ({ ...prev, [siteModel]: key }))
      // 用户主动选了候选就视为要同步;清空(不映射)则视为跳过
      if (key) {
        setSelected((prev) =>
          prev[siteModel] ? prev : { ...prev, [siteModel]: true }
        )
      } else {
        setSelected((prev) =>
          prev[siteModel] === false ? prev : { ...prev, [siteModel]: false }
        )
      }
    },
    []
  )

  const handleSelectionChange = useCallback(
    (siteModel: string, checked: boolean) => {
      setSelected((prev) => ({ ...prev, [siteModel]: checked }))
    },
    []
  )

  // 弹框「确认同步」:只写入勾选的模型,把映射 key 解析回 (provider, model_name)
  const handleConfirmSync = useCallback(() => {
    const refs: Record<string, OfficialPriceMappingRef> = {}
    for (const [siteModel, key] of Object.entries(mappings)) {
      if (!key || !selected[siteModel]) continue
      const idx = key.lastIndexOf('|')
      if (idx <= 0 || idx === key.length - 1) continue
      refs[siteModel] = {
        provider: key.slice(0, idx),
        model_name: key.slice(idx + 1),
      }
    }
    applyMutation.mutate(refs)
  }, [mappings, selected, applyMutation])

  // 直接编辑折算后的展示货币单价(输入/输出/缓存读),先换回美元源价再反推倍率
  const handleEditConverted = useCallback(
    (
      siteModel: string,
      field: 'input' | 'output' | 'cacheRead',
      raw: string
    ) => {
      const parsed = Number.parseFloat(raw)
      if (!Number.isFinite(parsed) || parsed < 0) return
      // 存储侧保留全精度,显示侧再取整:先除后乘能还原用户输入(否则出现 0.547497 这类噪声)
      const usd = parsed / exchangeRate
      setEntries((prev) => {
        const base = prev[siteModel]
        if (!base) return prev
        const usdValues = entryToUsdValues(base)
        const next = { ...prev }
        // 人工改价打上 manual 标记,后续同步默认不再覆盖
        next[siteModel] = {
          ...usdValuesToEntry(base, { ...usdValues, [field]: usd }),
          source: 'manual',
        }
        return next
      })
    },
    [exchangeRate]
  )

  // 高峰价编辑:同口径折算;高峰输入价清空表示移除整组高峰价
  const handleEditPeakConverted = useCallback(
    (
      siteModel: string,
      field: 'input' | 'output' | 'cacheRead',
      raw: string
    ) => {
      const base = entries[siteModel]
      if (!base) return
      const existing = entryToUsdValues(base)
      const parsed = raw.trim() === '' ? null : Number.parseFloat(raw)
      if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) return
      const usd = parsed == null ? null : parsed / exchangeRate

      // 高峰输入价被清空 => 移除整组高峰价,忽略其它字段
      if (field === 'input' && usd == null) {
        setEntries((prev) => {
          const b = prev[siteModel]
          if (!b) return prev
          return {
            ...prev,
            [siteModel]: {
              ...applyPeakUsdValues(b, {
                input: null,
                output: null,
                cacheRead: null,
              }),
              source: 'manual',
            },
          }
        })
        return
      }

      const peak: {
        input: number | null
        output: number | null
        cacheRead: number | null
      } = {
        input: existing.peakInput,
        output: existing.peakOutput,
        cacheRead: existing.peakCacheRead,
      }
      peak[field] = usd
      if (peak.input == null) {
        // 尚无高峰输入价而先填了输出/缓存:无法反推倍率,忽略
        return
      }
      setEntries((prev) => {
        const b = prev[siteModel]
        if (!b) return prev
        return {
          ...prev,
          [siteModel]: {
            ...applyPeakUsdValues(b, peak),
            source: 'manual',
          },
        }
      })
    },
    [entries, exchangeRate]
  )

  const handleRemoveEntry = useCallback((siteModel: string) => {
    setEntries((prev) => {
      const next = { ...prev }
      delete next[siteModel]
      return next
    })
  }, [])

  const handleSave = useCallback(() => {
    saveMutation.mutate(entries)
  }, [entries, saveMutation])

  // 表格按官方价美元汇率把美元源价折算成展示货币显示与编辑
  const currencySymbol = useMemo(() => getDisplayCurrencySymbol(), [])
  const toDisplay = useCallback(
    (usd: number | null) => (usd == null ? null : roundTo6(usd * exchangeRate)),
    [exchangeRate]
  )

  const renderPriceInput = (
    siteModel: string,
    field: 'input' | 'output' | 'cacheRead',
    usdValue: number | null,
    peak = false
  ) => {
    const display = toDisplay(usdValue)
    return (
      <Input
        type='number'
        min={0}
        step='any'
        defaultValue={display == null ? '' : String(display)}
        key={`${siteModel}-${peak ? 'peak-' : ''}${field}-${display ?? 'null'}-${exchangeRate}`}
        onBlur={(event) =>
          peak
            ? handleEditPeakConverted(siteModel, field, event.target.value)
            : handleEditConverted(siteModel, field, event.target.value)
        }
        className='h-7 w-24 font-mono text-xs tabular-nums'
        placeholder={peak ? t('Peak') : undefined}
      />
    )
  }

  return (
    <div className='flex min-h-0 flex-col gap-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <Button
          size='sm'
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          {t('Sync from models.dev')}
        </Button>
        {entriesLoaded && (
          <Button
            size='sm'
            variant='secondary'
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            {t('Save official price config')}
          </Button>
        )}
        <div className='ml-auto flex items-center gap-2'>
          <label
            htmlFor='official-price-exchange-rate'
            className='text-muted-foreground text-xs whitespace-nowrap'
            title={t(
              'Official prices come from models.dev in real USD; they are converted with this rate for display. Site prices stay quota-based.'
            )}
          >
            {t('Official price USD exchange rate')}
          </label>
          <Input
            id='official-price-exchange-rate'
            type='number'
            min={0}
            step='0.01'
            defaultValue={String(exchangeRate)}
            key={`rate-${exchangeRate}-${rateInputNonce}`}
            onBlur={(event) => handleExchangeRateBlur(event.target.value)}
            disabled={rateMutation.isPending}
            className='h-7 w-20 font-mono text-xs tabular-nums'
          />
        </div>
      </div>

      <OfficialPriceSyncDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        report={syncReport}
        mappings={mappings}
        onMappingChange={handleMappingChange}
        selected={selected}
        onSelectionChange={handleSelectionChange}
        onConfirm={handleConfirmSync}
        applying={applyMutation.isPending}
        exchangeRate={exchangeRate}
      />

      <Separator />

      <div className='min-h-0'>
        <div className='mb-1.5 flex flex-wrap items-center justify-between gap-2'>
          <div className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
            {t('Official price entries')}
          </div>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('Search models')}
            className='h-7 w-52 text-xs'
          />
        </div>
        {!entriesLoaded ? (
          <div className='text-muted-foreground text-sm'>{t('Loading...')}</div>
        ) : entryList.length === 0 ? (
          <div className='text-muted-foreground text-sm'>
            {t('No official price entries yet — sync from models.dev first')}
          </div>
        ) : (
          <div className='max-h-96 overflow-y-auto pr-1'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='text-muted-foreground text-left text-xs'>
                  <th className='py-1 pr-2 font-medium'>{t('Site model')}</th>
                  <th className='py-1 pr-2 font-medium'>
                    {t('Official model')}
                  </th>
                  <th className='py-1 pr-2 font-medium'>
                    {t('Input {{symbol}}/1M', { symbol: currencySymbol })}
                  </th>
                  <th className='py-1 pr-2 font-medium'>
                    {t('Output {{symbol}}/1M', { symbol: currencySymbol })}
                  </th>
                  <th className='py-1 pr-2 font-medium'>
                    {t('Cache read {{symbol}}/1M', { symbol: currencySymbol })}
                  </th>
                  <th
                    className='text-muted-foreground/70 py-1 pr-2 font-medium'
                    title={t(
                      'Peak-period official price for time-tiered models (optional); the base columns hold the off-peak tier.'
                    )}
                  >
                    {t('Peak input {{symbol}}/1M', { symbol: currencySymbol })}
                  </th>
                  <th className='text-muted-foreground/70 py-1 pr-2 font-medium'>
                    {t('Peak output {{symbol}}/1M', { symbol: currencySymbol })}
                  </th>
                  <th className='text-muted-foreground/70 py-1 font-medium'>
                    {t('Peak cache read {{symbol}}/1M', {
                      symbol: currencySymbol,
                    })}
                  </th>
                  <th className='py-1 font-medium'></th>
                </tr>
              </thead>
              <tbody>
                {entryList.map(({ name, entry }) => {
                  const usd = entryToUsdValues(entry)
                  return (
                    <tr key={name} className='border-t'>
                      <td className='py-1.5 pr-2'>
                        <div className='flex flex-wrap items-center gap-1.5'>
                          <span className='font-mono text-xs break-all'>
                            {name}
                          </span>
                          {entry.source === 'manual' && (
                            <Badge
                              variant='outline'
                              className='border-blue-500 px-1 py-0 text-[10px] text-blue-600 dark:text-blue-400'
                            >
                              {t('Manually edited')}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className='text-muted-foreground py-1.5 pr-2 font-mono text-xs break-all'>
                        {entry.official_model_name}
                      </td>
                      <td className='py-1.5 pr-2'>
                        {renderPriceInput(name, 'input', usd.input)}
                      </td>
                      <td className='py-1.5 pr-2'>
                        {renderPriceInput(name, 'output', usd.output)}
                      </td>
                      <td className='py-1.5 pr-2'>
                        {renderPriceInput(name, 'cacheRead', usd.cacheRead)}
                      </td>
                      <td className='py-1.5 pr-2'>
                        {renderPriceInput(name, 'input', usd.peakInput, true)}
                      </td>
                      <td className='py-1.5 pr-2'>
                        {renderPriceInput(name, 'output', usd.peakOutput, true)}
                      </td>
                      <td className='py-1.5'>
                        {renderPriceInput(
                          name,
                          'cacheRead',
                          usd.peakCacheRead,
                          true
                        )}
                      </td>
                      <td className='py-1.5 text-right'>
                        <Button
                          size='sm'
                          variant='ghost'
                          className='h-6 px-2 text-xs'
                          onClick={() => handleRemoveEntry(name)}
                        >
                          {t('Delete')}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {entriesLoaded && (
          <div className='text-muted-foreground/70 mt-1.5 text-xs'>
            {t(
              'Prices are shown and edited in display currency (converted by the exchange rate); the USD source price is stored and re-converted when the rate changes.'
            )}
          </div>
        )}
      </div>
    </div>
  )
}
