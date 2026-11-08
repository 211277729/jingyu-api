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

import { ConfirmDialog } from '@/components/confirm-dialog'
import { handleServerError } from '@/lib/handle-server-error'

import { deleteResource, invalidatePublicResources } from '../api'
import { useResourcesAdmin } from './resources-provider'

/** 删除确认：条目直接从库中消失，前台详情链接随之 404。 */
export function ResourceDeleteDialog() {
  const { t } = useTranslation()
  const { open, setOpen, currentRow, triggerRefresh } = useResourcesAdmin()
  const queryClient = useQueryClient()
  const [isDeleting, setIsDeleting] = useState(false)

  const isOpen = open === 'delete' && !!currentRow

  const handleConfirm = async () => {
    if (!currentRow) return
    setIsDeleting(true)
    try {
      await deleteResource(currentRow.id)
      toast.success(t('Resource deleted'))
      invalidatePublicResources(queryClient)
      setOpen(null)
      triggerRefresh()
    } catch (error) {
      handleServerError(error, t('Failed to delete resource'))
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) setOpen(null)
      }}
      destructive
      isLoading={isDeleting}
      title={t('Delete resource')}
      desc={
        currentRow
          ? t(
              'Delete "{{name}}" permanently? The public page will stop showing it immediately.',
              { name: currentRow.name }
            )
          : ''
      }
      confirmText={t('Delete')}
      handleConfirm={() => void handleConfirm()}
    />
  )
}
