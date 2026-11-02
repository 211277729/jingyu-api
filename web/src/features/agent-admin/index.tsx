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
import { useState } from 'react'

import { SectionPageLayout } from '@/components/layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CommissionsTable } from '@/features/agent-admin/components/commissions-table'
import { ProfilesTable } from '@/features/agent-admin/components/profiles-table'
import { WithdrawalsTable } from '@/features/agent-admin/components/withdrawals-table'

/**
 * 管理端代理分销：申请审核 / 代理列表 / 提现审核 / 佣金明细。
 * 受控 Tab：两个 ProfilesTable 实例共用组件但 mode 不同，受控 + key 强制
 * 重挂载，避免状态残留。
 */
export function AgentAdmin() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('applications')

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Agent Distribution')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value='applications'>{t('Applications')}</TabsTrigger>
            <TabsTrigger value='agents'>{t('Agents')}</TabsTrigger>
            <TabsTrigger value='withdrawals'>{t('Withdrawal Review')}</TabsTrigger>
            <TabsTrigger value='commissions'>{t('Commission Details')}</TabsTrigger>
          </TabsList>
          <TabsContent value='applications'>
            {tab === 'applications' ? <ProfilesTable mode='applications' /> : null}
          </TabsContent>
          <TabsContent value='agents'>
            {tab === 'agents' ? <ProfilesTable mode='manage' /> : null}
          </TabsContent>
          <TabsContent value='withdrawals'>
            {tab === 'withdrawals' ? <WithdrawalsTable /> : null}
          </TabsContent>
          <TabsContent value='commissions'>
            {tab === 'commissions' ? <CommissionsTable /> : null}
          </TabsContent>
        </Tabs>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
