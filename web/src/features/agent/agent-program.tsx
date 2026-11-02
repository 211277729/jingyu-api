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
import { PublicLayout } from '@/components/layout'
import { AgentProgramContent } from '@/features/agent/agent-program-content'

/**
 * 代理赚钱公开落地页（顶栏导航入口）：整页内容（含标题/背景/宣传）都在
 * AgentProgramContent 中，与后台 /agent 完全一致；这里只提供站点公共外壳。
 */
export function AgentProgram() {
  return (
    <PublicLayout showMainContainer={false}>
      <AgentProgramContent />
    </PublicLayout>
  )
}
