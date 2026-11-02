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
import { AgentProgramContent } from '@/features/agent/agent-program-content'

/**
 * 后台代理计划页（侧边栏「个人 → 代理计划」）：整页内容与公开页 /agent-program
 * 完全一致，区别只是后台内容区外多一层页面小标题外壳。
 */
export function Agent() {
  const { t } = useTranslation()
  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Agent Program')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <AgentProgramContent />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
