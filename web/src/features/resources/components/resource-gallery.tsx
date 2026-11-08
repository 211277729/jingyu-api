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
import { PackageSearch } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Button } from '@/components/ui/button'

import type { ResourceItem } from '../types'
import { ResourceCard } from './resource-card'

const GRID_CLASS_NAME =
  'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'

/** 骨架屏固定 8 张；用常量数组占位，避免渲染时现造索引当 key */
const SKELETON_KEYS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']

function ResourceGridSkeleton() {
  return (
    <div className={GRID_CLASS_NAME}>
      {SKELETON_KEYS.map((key) => (
        <div
          key={key}
          className='border-border/60 bg-card/40 h-36 animate-pulse rounded-xl border'
        />
      ))}
    </div>
  )
}

type ResourceGalleryProps = {
  isLoading: boolean
  isError: boolean
  /** 接口返回的全部条目（未过滤） */
  items: ResourceItem[]
  /** 已按类别与关键字过滤后的条目 */
  filtered: ResourceItem[]
  onRetry: () => void
  onClearFilters: () => void
}

/** 广场正文：加载 / 失败 / 空库 / 搜索无结果 / 正常网格，五种状态各自返回。 */
export function ResourceGallery({
  isLoading,
  isError,
  items,
  filtered,
  onRetry,
  onClearFilters,
}: ResourceGalleryProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return <ResourceGridSkeleton />
  }

  if (isError) {
    return (
      <ErrorState
        title={t('Failed to load resources')}
        description={t('The resource list is unavailable right now.')}
        onRetry={onRetry}
      />
    )
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={t('No resources yet')}
        description={t(
          'Resources published from the admin console will show up here.'
        )}
      />
    )
  }

  if (filtered.length === 0) {
    return (
      <div className='text-muted-foreground mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center'>
        <PackageSearch
          aria-hidden
          className='text-muted-foreground/40 size-10'
        />
        <p className='text-sm'>
          {t('No resources match your search. Try a different keyword.')}
        </p>
        <Button variant='outline' size='sm' onClick={onClearFilters}>
          {t('All')}
        </Button>
      </div>
    )
  }

  return (
    <div className={GRID_CLASS_NAME}>
      {filtered.map((item) => (
        <ResourceCard key={item.slug} item={item} />
      ))}
    </div>
  )
}
