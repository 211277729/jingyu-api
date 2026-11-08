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
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'

import { ResourcesDialogs } from './components/resources-dialogs'
import { ResourcesPrimaryButtons } from './components/resources-primary-buttons'
import { ResourcesProvider } from './components/resources-provider'
import { ResourcesTable } from './components/resources-table'

/** 资源管理：MCP / Skills / Agent 工具三类统一维护，改动即时影响资源广场。 */
export function ResourcesAdmin() {
  const { t } = useTranslation()
  return (
    <ResourcesProvider>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>
          {t('Resource Management')}
        </SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <ResourcesPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <ResourcesTable />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <ResourcesDialogs />
    </ResourcesProvider>
  )
}
