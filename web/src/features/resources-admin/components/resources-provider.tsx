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
import React, { useState } from 'react'

import useDialogState from '@/hooks/use-dialog'

import type { ResourceAdminItem, ResourcesDialogType } from '../types'

type ResourcesContextType = {
  open: ResourcesDialogType | null
  setOpen: (type: ResourcesDialogType | null) => void
  currentRow: ResourceAdminItem | null
  setCurrentRow: React.Dispatch<React.SetStateAction<ResourceAdminItem | null>>
  refreshTrigger: number
  triggerRefresh: () => void
}

const ResourcesContext = React.createContext<ResourcesContextType | null>(null)

/** 资源管理页的对话框状态：新建 / 编辑共用抽屉，删除单独确认。 */
export function ResourcesProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useDialogState<ResourcesDialogType>(null)
  const [currentRow, setCurrentRow] = useState<ResourceAdminItem | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  return (
    <ResourcesContext
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </ResourcesContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useResourcesAdmin = () => {
  const context = React.useContext(ResourcesContext)
  if (!context) {
    throw new Error(
      'useResourcesAdmin has to be used within <ResourcesProvider>'
    )
  }
  return context
}
