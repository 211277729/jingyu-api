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
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { PageTransition } from '@/components/page-transition'
import { Skeleton } from '@/components/ui/skeleton'
import { getAgentProfile } from '@/features/agent/api'
import { AgentApplyCard } from '@/features/agent/components/agent-apply-card'
import { AgentDashboard } from '@/features/agent/components/agent-dashboard'
import { useStatus } from '@/hooks/use-status'

/**
 * 代理计划整页内容（后台 /agent 与公开页 /agent-program 共用）：
 * 顶部金色渐变 + 大标题 + 副标题也是内容的一部分，两个入口完全一致。
 * 后台入口仅多出左侧菜单与页面小标题「代理计划」外壳，内容区渲染的就是这里。
 * 未申请/被拒 → 招代理落地 + 申请表单；审核中 → 状态卡；已通过 → 代理中心。
 */
export function AgentProgramContent() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const agentEnabled = status?.agent_enabled === true

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['agent-profile'],
    queryFn: getAgentProfile,
    enabled: agentEnabled,
  })

  const renderBody = () => {
    if (!agentEnabled) {
      return (
        <div className='border-border/60 bg-muted/30 text-muted-foreground flex items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-sm'>
          {t('Agent distribution feature is not enabled')}
        </div>
      )
    }
    if (isLoading || !data) {
      return (
        <div className='space-y-4'>
          <Skeleton className='h-40 w-full rounded-2xl' />
          <Skeleton className='h-24 w-full rounded-2xl' />
        </div>
      )
    }
    if (data.status === 'approved') {
      return <AgentDashboard data={data} onRefresh={() => void refetch()} />
    }
    return (
      <AgentApplyCard
        status={data.status}
        profile={data.profile}
        firstPercent={data.first_percent}
        percent={data.percent}
        secondPercent={data.second_percent}
        onApplied={() => void refetch()}
      />
    )
  }

  return (
    <div className='relative'>
      {/* 金色系径向渐变背景，公开页与后台内容区一致 */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-25 dark:opacity-[0.12]'
        style={{
          background: [
            'radial-gradient(ellipse 60% 50% at 25% 15%, oklch(0.78 0.16 80 / 80%) 0%, transparent 70%)',
            'radial-gradient(ellipse 50% 40% at 75% 20%, oklch(0.70 0.15 300 / 60%) 0%, transparent 70%)',
          ].join(', '),
          maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, black 40%, transparent 100%)',
        }}
      />
      <PageTransition className='relative mx-auto w-full max-w-[1280px] space-y-8 px-3 pt-16 pb-12 sm:px-6 sm:pt-24'>
        {/* 页头大标题，两个入口共享 */}
        <div className='text-center'>
          <h1 className='text-2xl font-bold sm:text-3xl'>
            {t('Agent Earnings')}
          </h1>
          <p className='text-muted-foreground mx-auto mt-2 max-w-2xl text-sm'>
            {t(
              'Share your invite link: customers who sign up through it belong to you permanently. You earn commission on every top-up they make, and it can be withdrawn as cash.'
            )}
          </p>
        </div>

        {renderBody()}
      </PageTransition>
    </div>
  )
}
