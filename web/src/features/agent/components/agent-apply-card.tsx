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
import {
  Activity,
  Banknote,
  Handshake,
  Hourglass,
  Network,
  OctagonX,
  PenLine,
  ShieldCheck,
  Share2,
  Undo2,
  Users,
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { applyAgent } from '@/features/agent/api'
import type { AgentProfile, AgentProfileData } from '@/features/agent/types'
import { handleServerError } from '@/lib/handle-server-error'
import { toast } from 'sonner'

interface AgentApplyCardProps {
  /** none = 从未申请；rejected/disabled 可重新申请；pending 审核中 */
  status: AgentProfileData['status']
  profile?: AgentProfile
  /** 全局费率（档案未覆盖时展示用） */
  firstPercent: number
  percent: number
  secondPercent: number
  onApplied: () => void
}

/**
 * 招代理落地页：费率横幅 + 权益说明 + 三步流程 + 申请表单；
 * 已申请但未通过时展示状态卡。后台 /agent 与公开页 /agent-program 共用。
 */
export function AgentApplyCard({
  status,
  profile,
  firstPercent,
  percent,
  secondPercent,
  onApplied,
}: AgentApplyCardProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [contact, setContact] = useState('')
  const [remark, setRemark] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!contact.trim()) {
      toast.error(t('Contact information is required'))
      return
    }
    setSubmitting(true)
    try {
      await applyAgent(contact.trim(), remark.trim())
      toast.success(t('Application submitted, please wait for review'))
      // 立即失效档案查询，让父页面 refetch 后切到"审核中"状态卡
      await queryClient.invalidateQueries({ queryKey: ['agent-profile'] })
      onApplied()
    } catch (error) {
      handleServerError(error, t('Failed to submit application'))
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'pending') {
    return (
      <div className='border-border/60 bg-muted/30 flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-14 text-center'>
        <span className='bg-amber-500/10 text-amber-600 dark:text-amber-400 flex size-12 items-center justify-center rounded-full'>
          <Hourglass className='size-6' />
        </span>
        <div className='text-lg font-semibold'>{t('Application under review')}</div>
        <p className='text-muted-foreground max-w-md text-sm'>
          {t('Your agent application has been submitted. We will review it as soon as possible.')}
        </p>
      </div>
    )
  }

  if (status === 'disabled') {
    return (
      <div className='border-border/60 bg-muted/30 flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-14 text-center'>
        <span className='bg-red-500/10 text-red-600 dark:text-red-400 flex size-12 items-center justify-center rounded-full'>
          <OctagonX className='size-6' />
        </span>
        <div className='text-lg font-semibold'>{t('Agent account disabled')}</div>
        <p className='text-muted-foreground max-w-md text-sm'>
          {profile?.remark || t('Your agent account has been disabled. Contact support if you have questions.')}
        </p>
      </div>
    )
  }

  const benefits = [
    {
      icon: Users,
      title: t('Permanent customer attribution'),
      desc: t(
        'Customers who sign up through your link stay bound to you forever — every top-up they make earns you commission.'
      ),
    },
    {
      icon: Banknote,
      title: t('Cash commission'),
      desc: t(
        'Commission is real withdrawable balance, not site credit. Request payout any time once you meet the minimum.'
      ),
    },
    {
      icon: Network,
      title: t('Two-level commission'),
      desc: t(
        'Bring in other agents and you also earn a second-level cut from their customers.'
      ),
    },
    {
      icon: Activity,
      title: t('Real-time dashboard'),
      desc: t(
        'Customers, commission records and withdrawal progress are all tracked in your agent center.'
      ),
    },
  ] as const

  const steps = [
    {
      icon: PenLine,
      title: t('Submit application'),
      desc: t('Fill in a contact method; we usually review quickly.'),
    },
    {
      icon: ShieldCheck,
      title: t('Get approved'),
      desc: t('Once approved, your agent center and invite link are ready to go.'),
    },
    {
      icon: Share2,
      title: t('Share & earn'),
      desc: t(
        'Share your invite link — commission credits automatically on every customer top-up.'
      ),
    },
  ] as const

  return (
    <div className='space-y-5'>
      {/* 费率横幅 */}
      <div className='border-amber-500/20 from-amber-500/15 via-orange-500/8 to-transparent rounded-2xl border bg-gradient-to-r p-5 sm:p-6'>
        <div className='flex items-center gap-2.5'>
          <span className='bg-amber-500/15 text-amber-600 dark:text-amber-400 flex size-10 items-center justify-center rounded-xl'>
            <Handshake className='size-5' />
          </span>
          <div className='text-lg font-bold sm:text-xl'>{t('Become an Agent')}</div>
        </div>
        <p className='text-muted-foreground mt-2.5 text-sm'>
          {t('No caps, no expiry — withdraw your commission as cash.')}
        </p>
        <div className='mt-4 grid grid-cols-3 gap-3'>
          {[
            { value: firstPercent, label: t('First top-up') },
            { value: percent, label: t('Every top-up after') },
            { value: secondPercent, label: t('Second-level commission') },
          ].map((item) => (
            <div
              key={item.label}
              className='bg-background/80 border-border/60 rounded-xl border px-3 py-3.5 text-center shadow-sm backdrop-blur'
            >
              <div className='from-amber-600 to-orange-500 dark:from-amber-400 dark:to-orange-400 bg-gradient-to-br bg-clip-text text-xl font-bold tabular-nums text-transparent sm:text-2xl'>
                {item.value}%
              </div>
              <div className='text-muted-foreground mt-1 text-[11px] font-medium sm:text-xs'>
                {item.label}
              </div>
            </div>
          ))}
        </div>
        {status === 'rejected' && profile ? (
          <div className='mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400'>
            {profile.remark || t('Your previous application was rejected. You can apply again.')}
          </div>
        ) : null}
      </div>

      <div className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)] xl:items-start'>
        {/* 权益 + 流程 */}
        <div className='space-y-5'>
          <section className='space-y-3'>
            <h3 className='text-base font-semibold'>{t('Why join?')}</h3>
            <div className='grid gap-3 sm:grid-cols-2'>
              {benefits.map((item) => (
                <div
                  key={item.title}
                  className='border-border/60 bg-muted/30 hover:border-amber-500/40 rounded-xl border p-4 transition-colors'
                >
                  <div className='flex items-center gap-2'>
                    <span className='bg-amber-500/10 text-amber-600 dark:text-amber-400 flex size-7 items-center justify-center rounded-md'>
                      <item.icon className='size-3.5' />
                    </span>
                    <div className='text-sm font-semibold'>{item.title}</div>
                  </div>
                  <p className='text-muted-foreground mt-2 text-xs leading-relaxed'>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className='space-y-3'>
            <h3 className='text-base font-semibold'>{t('How it works')}</h3>
            <ol className='space-y-3'>
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className='border-border/60 bg-muted/30 flex items-start gap-3 rounded-xl border p-4'
                >
                  <span className='bg-amber-500/15 text-amber-600 dark:text-amber-400 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold'>
                    {index + 1}
                  </span>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-1.5 text-sm font-semibold'>
                      <step.icon className='text-muted-foreground size-3.5' />
                      {step.title}
                    </div>
                    <p className='text-muted-foreground mt-1 text-xs leading-relaxed'>
                      {step.desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        {/* 申请表单 */}
        <div className='border-border/60 bg-card space-y-3 rounded-2xl border p-5 shadow-sm xl:sticky xl:top-4'>
          <div className='flex items-center gap-2 text-sm font-semibold'>
            <Undo2 className='text-muted-foreground size-4' />
            {status === 'rejected' ? t('Apply Again') : t('Agent Application')}
          </div>
          <div className='space-y-1.5'>
            <label className='text-muted-foreground text-xs font-medium'>
              {t('Contact (WeChat / QQ / Telegram)')}
            </label>
            <Input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={t('How should we reach you?')}
              maxLength={128}
            />
          </div>
          <div className='space-y-1.5'>
            <label className='text-muted-foreground text-xs font-medium'>
              {t('Promotion plan (optional)')}
            </label>
            <Textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder={t('Briefly describe how you plan to promote our service.')}
              rows={3}
              maxLength={255}
            />
          </div>
          <Button className='w-full' onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('Submitting') : t('Submit Application')}
          </Button>
          {status === 'rejected' ? (
            <Badge variant='outline' className='w-full justify-center'>
              {t('Previous application was rejected')}
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  )
}
