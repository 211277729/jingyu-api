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
 * 控制台风格但主题自适应（浅/深两套都成立，跟随站点主题 token）：
 * 顶部金色系氛围层 + 细点阵 + Hero 玻璃面板 + 渐变大标题，佣金主题保持金色。
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
        <div className='border-border/60 text-muted-foreground flex flex-col items-center gap-2 rounded-3xl border border-dashed px-6 py-16 text-center text-sm'>
          <span className='bg-gradient-to-br from-amber-600 to-orange-500 bg-clip-text text-2xl font-bold text-transparent sm:text-3xl dark:from-amber-400 dark:to-orange-400'>
            {t('Agent Earnings')}
          </span>
          {t('Agent distribution feature is not enabled')}
        </div>
      )
    }
    if (isLoading || !data) {
      return (
        <div className='space-y-4'>
          <Skeleton className='h-48 w-full rounded-3xl' />
          <Skeleton className='h-28 w-full rounded-3xl' />
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
      {/* 页面级氛围：金色细点阵 + 金/紫径向光晕，折叠线以下淡出 */}
      <div
        aria-hidden
        className='pointer-events-none absolute inset-x-0 top-0 h-[560px]'
      >
        <div
          className='absolute inset-0 opacity-[0.10] dark:opacity-[0.055]'
          style={{
            backgroundImage:
              'linear-gradient(to right, oklch(0.72 0.12 70 / 70%) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.72 0.12 70 / 70%) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage:
              'radial-gradient(ellipse 75% 65% at 50% 0%, black 25%, transparent 78%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 75% 65% at 50% 0%, black 25%, transparent 78%)',
          }}
        />
        <div
          className='absolute inset-0 opacity-25 dark:opacity-[0.12]'
          style={{
            background: [
              'radial-gradient(ellipse 60% 50% at 25% 15%, oklch(0.78 0.16 80 / 80%) 0%, transparent 70%)',
              'radial-gradient(ellipse 50% 40% at 75% 20%, oklch(0.70 0.15 300 / 60%) 0%, transparent 70%)',
            ].join(', '),
            maskImage:
              'linear-gradient(to bottom, black 40%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, black 40%, transparent 100%)',
          }}
        />
      </div>

      <PageTransition className='relative mx-auto w-full max-w-6xl space-y-6 px-3 pt-16 pb-12 sm:px-6 sm:pt-24 sm:pb-16'>
        {/* ── Hero 玻璃面板 ─────────────────────────────────────── */}
        <header className='border-border/60 bg-card/70 relative overflow-hidden rounded-3xl border px-5 py-10 shadow-sm backdrop-blur-sm sm:px-10 sm:py-14'>
          <div
            aria-hidden
            className='pointer-events-none absolute -top-24 -left-16 size-80 rounded-full bg-amber-500/20 blur-3xl dark:bg-amber-500/15'
          />
          <div
            aria-hidden
            className='pointer-events-none absolute -right-20 -bottom-32 size-96 rounded-full bg-orange-400/10 blur-3xl'
          />

          <div className='relative space-y-4'>
            <p className='flex items-center justify-center gap-2 font-mono text-[11px] tracking-[0.32em] text-amber-600/90 uppercase dark:text-amber-400/80'>
              <span
                aria-hidden
                className='bg-amber-500/80 motion-safe:size-1.5 motion-safe:animate-pulse motion-safe:rounded-full dark:bg-amber-400/80'
              />
              Agent Program
            </p>
            <h1 className='from-foreground via-foreground w-fit bg-gradient-to-r to-amber-600 bg-clip-text text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.12] font-bold tracking-tight text-transparent dark:to-amber-400'>
              {t('Agent Earnings')}
            </h1>
            <p className='text-muted-foreground mx-auto max-w-3xl text-sm leading-relaxed sm:text-base'>
              {t(
                'Share your invite link: customers who sign up through it belong to you permanently. You earn commission on every top-up they make, and it can be withdrawn as cash.'
              )}
            </p>
          </div>
        </header>

        {renderBody()}
      </PageTransition>
    </div>
  )
}
