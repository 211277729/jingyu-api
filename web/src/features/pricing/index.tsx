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
import { Link } from '@tanstack/react-router'
import { Activity, ArrowLeftRight, ChevronRight, Gift } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { cn } from '@/lib/utils'

import {
  LoadingSkeleton,
  EmptyState,
  SearchBar,
  PricingTable,
  PricingSidebar,
  PricingToolbar,
  ModelCardGrid,
  ModelDetailsDrawer,
} from './components'
import { EXCLUDED_GROUPS, VIEW_MODES } from './constants'
import { useFilters } from './hooks/use-filters'
import { usePricingData } from './hooks/use-pricing-data'
import { getModelQuotaType } from './lib/filters'

export function Pricing() {
  const { t } = useTranslation()
  const [selectedModelName, setSelectedModelName] = useState<string | null>(
    null
  )

  const {
    models,
    vendors,
    groupRatio,
    usableGroup,
    endpointMap,
    autoGroups,
    isLoading,
    priceRate,
    usdExchangeRate,
  } = usePricingData()

  const {
    searchInput,
    sortBy,
    vendorFilter,
    groupFilter,
    quotaTypeFilter,
    endpointTypeFilter,
    tagFilter,
    tokenUnit,
    viewMode,
    showRechargePrice,
    setSearchInput,
    setSortBy,
    setVendorFilter,
    setGroupFilter,
    setQuotaTypeFilter,
    setEndpointTypeFilter,
    setTagFilter,
    setTokenUnit,
    setViewMode,
    setShowRechargePrice,
    filteredModels,
    hasActiveFilters,
    activeFilterCount,
    availableTags,
    clearFilters,
    clearSearch,
  } = useFilters(models || [])

  const handleModelClick = useCallback((modelName: string) => {
    setSelectedModelName(modelName)
  }, [])

  const selectedModel = useMemo(
    () =>
      selectedModelName
        ? (models || []).find(
            (model) => model.model_name === selectedModelName
          ) || null
        : null,
    [models, selectedModelName]
  )

  const availableGroups = useMemo(
    () =>
      Object.keys(usableGroup || {}).filter(
        (g) => !EXCLUDED_GROUPS.includes(g)
      ),
    [usableGroup]
  )

  const handleClearAll = useCallback(() => {
    clearFilters()
    clearSearch()
  }, [clearFilters, clearSearch])

  const stats = useMemo(() => {
    const list = models || []
    const vendors = new Set<string>()
    const endpoints = new Set<string>()
    const billingModes = new Set<string>()
    for (const model of list) {
      if (model.vendor_name) vendors.add(model.vendor_name)
      for (const endpoint of model.supported_endpoint_types ?? []) {
        endpoints.add(endpoint)
      }
      const quotaType = getModelQuotaType(model)
      if (quotaType) billingModes.add(quotaType)
    }
    return {
      models: list.length,
      vendors: vendors.size,
      endpoints: endpoints.size,
      billingModes: billingModes.size,
    }
  }, [models])

  const statItems = useMemo(
    () => [
      { label: t('Models'), value: stats.models },
      { label: t('Providers'), value: stats.vendors },
      { label: t('Endpoint types'), value: stats.endpoints },
      { label: t('Billing modes'), value: stats.billingModes },
    ],
    [t, stats]
  )

  const renderPricingContent = () => {
    if (filteredModels.length === 0) {
      return (
        <EmptyState
          searchQuery={searchInput}
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearAll}
        />
      )
    }

    if (viewMode === VIEW_MODES.CARD) {
      return (
        <ModelCardGrid
          models={filteredModels}
          onModelClick={handleModelClick}
          priceRate={priceRate}
          usdExchangeRate={usdExchangeRate}
          tokenUnit={tokenUnit}
          showRechargePrice={showRechargePrice}
          selectedGroup={groupFilter}
        />
      )
    }

    return (
      <PricingTable
        models={filteredModels}
        priceRate={priceRate}
        usdExchangeRate={usdExchangeRate}
        tokenUnit={tokenUnit}
        showRechargePrice={showRechargePrice}
        selectedGroup={groupFilter}
        onModelClick={handleModelClick}
      />
    )
  }

  if (isLoading) {
    return (
      <PublicLayout showMainContainer={false}>
        <div className='mx-auto w-full max-w-[1800px] px-3 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10 xl:px-8'>
          <LoadingSkeleton viewMode={viewMode} />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <div className='relative'>
        {/* 背景层：细网格 + 极光晕，全部静态绘制，避免动画开销 */}
        <div
          aria-hidden
          className='pointer-events-none absolute inset-x-0 top-0 h-[760px] overflow-hidden'
        >
          <div
            className='absolute inset-0 opacity-[0.5] dark:opacity-100'
            style={{
              backgroundImage: [
                'linear-gradient(to right, color-mix(in oklch, var(--foreground) 6%, transparent) 1px, transparent 1px)',
                'linear-gradient(to bottom, color-mix(in oklch, var(--foreground) 6%, transparent) 1px, transparent 1px)',
              ].join(', '),
              backgroundSize: '44px 44px',
              maskImage:
                'radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 100%)',
              WebkitMaskImage:
                'radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 100%)',
            }}
          />
          <div
            className='absolute inset-0 opacity-25 dark:opacity-40'
            style={{
              background: [
                'radial-gradient(ellipse 55% 45% at 18% 8%, color-mix(in oklch, var(--chart-1) 70%, transparent) 0%, transparent 70%)',
                'radial-gradient(ellipse 45% 38% at 82% 4%, color-mix(in oklch, var(--chart-4) 55%, transparent) 0%, transparent 70%)',
                'radial-gradient(ellipse 60% 40% at 50% 30%, color-mix(in oklch, var(--chart-3) 40%, transparent) 0%, transparent 75%)',
              ].join(', '),
              maskImage:
                'linear-gradient(to bottom, black 45%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, black 45%, transparent 100%)',
            }}
          />
        </div>
        <PageTransition className='relative mx-auto w-full max-w-[1800px] px-3 pt-16 pb-8 sm:px-6 sm:pt-20 sm:pb-10 xl:px-8'>
          <header className='mx-auto mb-6 max-w-3xl pt-4 text-center sm:mb-10 sm:pt-10'>
            <div className='border-border/60 bg-background/60 mx-auto inline-flex items-center gap-2 rounded-full border px-3 py-1 shadow-sm backdrop-blur-sm'>
              <span className='relative flex size-1.5'>
                <span className='bg-success absolute inline-flex h-full w-full animate-ping rounded-full opacity-60' />
                <span className='bg-success relative inline-flex size-1.5 rounded-full' />
              </span>
              <span className='text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase'>
                {t('Live model index')}
              </span>
            </div>
            <h1 className='mt-4 bg-gradient-to-r from-[#3b82f6] via-[#6d5cf5] to-[#a855f7] bg-clip-text text-[clamp(2.1rem,5.5vw,3.6rem)] leading-[1.12] font-bold tracking-tight text-transparent sm:mt-5 dark:from-[#60a5fa] dark:via-[#8f7bff] dark:to-[#c084fc]'>
              {t('Model Square')}
            </h1>
            <p className='text-muted-foreground/90 mt-3 font-mono text-xs tracking-wide sm:mt-4 sm:text-sm'>
              {t('This site currently has {{count}} models enabled', {
                count: models?.length || 0,
              })}
            </p>
            <p className='text-muted-foreground/60 mx-auto mt-2 max-w-2xl text-xs leading-relaxed sm:text-sm'>
              {t(
                'Discover curated AI models, compare pricing and capabilities, and choose the right model for every scenario.'
              )}
            </p>
            <SearchBar
              value={searchInput}
              onChange={setSearchInput}
              onClear={clearSearch}
              placeholder={t(
                'Search model name, provider, endpoint, or tag...'
              )}
              className='mx-auto mt-5 max-w-2xl sm:mt-7'
            />

            {/* 数据读数条 */}
            <dl className='mx-auto mt-5 grid max-w-2xl grid-cols-2 gap-2 sm:mt-7 sm:grid-cols-4 sm:gap-3'>
              {statItems.map((item, index) => (
                <div
                  key={item.label}
                  className={cn(
                    'border-border/60 bg-card/50 relative overflow-hidden rounded-xl border px-3 py-2.5 text-left backdrop-blur-sm',
                    'transition-colors hover:border-primary/40'
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'absolute inset-y-3 left-0 w-0.5 rounded-full',
                      index % 2 === 0 ? 'bg-primary/60' : 'bg-chart-2/60'
                    )}
                  />
                  <dd className='font-mono text-xl leading-none font-semibold tabular-nums'>
                    {item.value.toLocaleString()}
                  </dd>
                  <dt className='text-muted-foreground mt-1.5 text-[11px] tracking-wide'>
                    {item.label}
                  </dt>
                </div>
              ))}
            </dl>
            <div className='mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:mt-4'>
              <div className='text-muted-foreground/50 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] uppercase'>
                <Activity aria-hidden className='size-3' />
                {t('Prices refresh with the live catalog')}
              </div>
              <span
                title={t(
                  'Site rate ¥1 = $1 · foreign models are uniformly quoted in ¥'
                )}
                className='border-primary/30 bg-primary/5 text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] tracking-wide'
              >
                <ArrowLeftRight
                  aria-hidden
                  className='text-primary/70 size-3'
                />
                {t(
                  'Site rate ¥1 = $1 · foreign models are uniformly quoted in ¥'
                )}
              </span>
              <Link
                to='/pricing/free'
                className='border-primary/30 bg-primary/5 text-foreground hover:border-primary/60 hover:bg-primary/10 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] tracking-wide transition-colors'
              >
                <Gift aria-hidden className='text-primary/70 size-3' />
                {t('Free models zone')}
                <ChevronRight aria-hidden className='size-3 opacity-60' />
              </Link>
            </div>
          </header>

          <div className='grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]'>
            <PricingSidebar
              quotaTypeFilter={quotaTypeFilter}
              endpointTypeFilter={endpointTypeFilter}
              vendorFilter={vendorFilter}
              groupFilter={groupFilter}
              tagFilter={tagFilter}
              onQuotaTypeChange={setQuotaTypeFilter}
              onEndpointTypeChange={setEndpointTypeFilter}
              onVendorChange={setVendorFilter}
              onGroupChange={setGroupFilter}
              onTagChange={setTagFilter}
              vendors={vendors || []}
              groups={availableGroups}
              groupRatios={groupRatio}
              tags={availableTags}
              models={models || []}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
              className='hover-scrollbar sticky top-20 hidden max-h-[calc(100dvh-6rem)] self-start overflow-y-auto xl:block'
            />

            <main className='min-w-0 space-y-4'>
              <PricingToolbar
                filteredCount={filteredModels.length}
                totalCount={models?.length}
                sortBy={sortBy}
                onSortChange={setSortBy}
                tokenUnit={tokenUnit}
                onTokenUnitChange={setTokenUnit}
                showRechargePrice={showRechargePrice}
                onRechargePriceChange={setShowRechargePrice}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                quotaTypeFilter={quotaTypeFilter}
                endpointTypeFilter={endpointTypeFilter}
                vendorFilter={vendorFilter}
                groupFilter={groupFilter}
                tagFilter={tagFilter}
                onQuotaTypeChange={setQuotaTypeFilter}
                onEndpointTypeChange={setEndpointTypeFilter}
                onVendorChange={setVendorFilter}
                onGroupChange={setGroupFilter}
                onTagChange={setTagFilter}
                vendors={vendors || []}
                groups={availableGroups}
                groupRatios={groupRatio}
                tags={availableTags}
                models={models || []}
                hasActiveFilters={hasActiveFilters}
                activeFilterCount={activeFilterCount}
                onClearFilters={clearFilters}
              />

              {renderPricingContent()}
            </main>
          </div>

          {selectedModel && (
            <ModelDetailsDrawer
              open={Boolean(selectedModel)}
              onOpenChange={(open) => {
                if (!open) setSelectedModelName(null)
              }}
              model={selectedModel}
              groupRatio={groupRatio || {}}
              usableGroup={usableGroup || {}}
              endpointMap={
                (endpointMap as Record<
                  string,
                  { path?: string; method?: string }
                >) || {}
              }
              autoGroups={autoGroups || []}
              priceRate={priceRate ?? 1}
              usdExchangeRate={usdExchangeRate ?? 1}
              tokenUnit={tokenUnit}
              showRechargePrice={showRechargePrice}
            />
          )}
        </PageTransition>
      </div>
    </PublicLayout>
  )
}
