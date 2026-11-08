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
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Switch } from '@/components/ui/switch'
import { handleServerError } from '@/lib/handle-server-error'

import { invalidatePublicResources, updateResource } from '../api'
import { rowToPayload } from '../lib/resource-form'
import type { ResourceAdminItem } from '../types'
import { useResourcesAdmin } from './resources-provider'

/**
 * 列表内直接切上/下架：PUT 是全量更新，所以把整行回写、
 * 只覆盖 enabled 一个字段，避免其它字段被清空。
 */
export function ResourceEnabledSwitch({ row }: { row: ResourceAdminItem }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { triggerRefresh } = useResourcesAdmin()
  const [isPending, setIsPending] = useState(false)

  const handleChange = async (next: boolean) => {
    setIsPending(true)
    try {
      await updateResource(rowToPayload(row, { enabled: next }))
      toast.success(next ? t('Resource published') : t('Resource unpublished'))
      invalidatePublicResources(queryClient)
      triggerRefresh()
    } catch (error) {
      handleServerError(error, t('Failed to update resource'))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Switch
      size='sm'
      checked={row.enabled}
      disabled={isPending}
      onCheckedChange={(checked) => void handleChange(Boolean(checked))}
      aria-label={t('Published')}
    />
  )
}
