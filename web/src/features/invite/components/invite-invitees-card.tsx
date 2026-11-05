import { ChevronDown, ChevronRight, Loader2, Users } from 'lucide-react'
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
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'
import type { UserWalletData } from '@/features/wallet/types'
import { getInvitees, type InviteeRecord } from '@/lib/api'
import { formatTimestampToDate } from '@/lib/format'
import { cn } from '@/lib/utils'

// Same role threshold as the backend: >= 10 is an admin.
const ROLE_ADMIN = 10

const STATUS_CONFIG: Record<
  number,
  { labelKey: string; variant: 'success' | 'neutral' | 'danger' }
> = {
  1: { labelKey: 'Enabled', variant: 'success' },
  2: { labelKey: 'Disabled', variant: 'neutral' },
  [-1]: { labelKey: 'Deleted', variant: 'danger' },
}

function InviteeRow({
  invitee,
  isAdmin,
  onToggle,
  expanded,
}: {
  invitee: InviteeRecord
  isAdmin: boolean
  expanded: boolean
  onToggle?: () => void
}) {
  const { t } = useTranslation()
  const statusConfig = STATUS_CONFIG[invitee.status]

  return (
    <div className='border-b last:border-b-0'>
      <button
        type='button'
        onClick={onToggle}
        disabled={!isAdmin}
        className={cn(
          'flex w-full items-center gap-2 py-2.5 text-left',
          isAdmin && 'hover:bg-muted/40 rounded-md px-2 -mx-2'
        )}
      >
        {isAdmin ? (
          expanded ? (
            <ChevronDown className='text-muted-foreground size-4 shrink-0' />
          ) : (
            <ChevronRight className='text-muted-foreground size-4 shrink-0' />
          )
        ) : null}
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <span className='truncate text-sm font-medium'>
              {invitee.username || invitee.display_name || `#${invitee.id}`}
            </span>
            {statusConfig ? (
              <StatusBadge
                variant={statusConfig.variant}
                size='sm'
                type='text'
                copyable={false}
                label={t(statusConfig.labelKey)}
              />
            ) : null}
            {isAdmin && invitee.aff_count > 0 ? (
              <span className='text-muted-foreground bg-muted/50 shrink-0 rounded-full px-2 py-0.5 text-xs'>
                {t('{{count}} nested invitees', { count: invitee.aff_count })}
              </span>
            ) : null}
          </div>
          {invitee.email ? (
            <div className='text-muted-foreground truncate text-xs'>
              {invitee.email}
            </div>
          ) : null}
        </div>
        <span className='text-muted-foreground shrink-0 text-xs whitespace-nowrap'>
          {formatTimestampToDate(invitee.created_at)}
        </span>
      </button>
      {isAdmin && expanded && invitee.aff_count > 0 ? (
        <NestedInviteeList userId={invitee.id} />
      ) : null}
    </div>
  )
}

function NestedInviteeList({ userId }: { userId: number }) {
  const { t } = useTranslation()
  const [nested, setNested] = useState<InviteeRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getInvitees(userId)
      .then((res) => {
        if (cancelled) return
        if (res.success && res.data) {
          setNested(res.data.invitees)
        } else {
          setError(res.message || t('Failed to load invite details'))
        }
      })
      .catch(() => {
        if (!cancelled) setError(t('Failed to load invite details'))
      })
    return () => {
      cancelled = true
    }
  }, [userId, t])

  if (error) {
    return <div className='text-destructive px-2 pb-2 text-xs'>{error}</div>
  }
  if (nested === null) {
    return (
      <div className='flex items-center gap-2 px-2 pb-2 text-xs'>
        <Loader2 className='text-muted-foreground size-3 animate-spin' />
      </div>
    )
  }
  if (nested.length === 0) {
    return (
      <div className='text-muted-foreground px-2 pb-2 text-xs'>
        {t('No invitees yet')}
      </div>
    )
  }
  return (
    <div className='border-muted-foreground/20 ml-4 space-y-0 border-l pl-2'>
      {nested.map((nestedInvitee) => (
        <div
          key={nestedInvitee.id}
          className='flex items-center gap-2 py-1.5 text-xs'
        >
          <span className='w-32 truncate font-medium'>
            {nestedInvitee.username ||
              nestedInvitee.display_name ||
              `#${nestedInvitee.id}`}
          </span>
          <span className='text-muted-foreground min-w-0 flex-1 truncate'>
            {nestedInvitee.email}
          </span>
          {STATUS_CONFIG[nestedInvitee.status] ? (
            <StatusBadge
              variant={STATUS_CONFIG[nestedInvitee.status].variant}
              size='sm'
              type='text'
              copyable={false}
              label={t(STATUS_CONFIG[nestedInvitee.status].labelKey)}
            />
          ) : null}
          <span className='text-muted-foreground whitespace-nowrap'>
            {formatTimestampToDate(nestedInvitee.created_at)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function InviteesCard({ user }: { user: UserWalletData | null }) {
  const { t } = useTranslation()
  const isAdmin = (user?.role ?? 0) >= ROLE_ADMIN
  const [invitees, setInvitees] = useState<InviteeRecord[] | null>(null)
  const [total, setTotal] = useState(0)
  const [cappedLimit, setCappedLimit] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const fetchInvitees = useCallback(async () => {
    try {
      setError(null)
      const res = await getInvitees()
      if (res.success && res.data) {
        setInvitees(res.data.invitees)
        setTotal(res.data.total)
        setCappedLimit(res.data.capped_limit)
      } else {
        setError(res.message || t('Failed to load invite details'))
      }
    } catch {
      setError(t('Failed to load invite details'))
    }
  }, [t])

  useEffect(() => {
    fetchInvitees()
  }, [fetchInvitees])

  return (
    <TitledCard
      disableHoverEffect
      title={
        <span className='flex items-center gap-2'>
          <Users className='size-4' />
          {t('Invite details')}
        </span>
      }
    >
      {error ? (
        <p className='text-destructive text-sm'>{error}</p>
      ) : invitees === null ? (
        <div className='space-y-2'>
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-2/3' />
        </div>
      ) : invitees.length === 0 ? (
        <p className='text-muted-foreground text-sm'>{t('No invitees yet')}</p>
      ) : (
        <div className='flex flex-col'>
          {invitees.map((invitee) => (
            <InviteeRow
              key={invitee.id}
              invitee={invitee}
              isAdmin={isAdmin}
              expanded={expandedId === invitee.id}
              onToggle={
                isAdmin
                  ? () =>
                      setExpandedId((prev) =>
                        prev === invitee.id ? null : invitee.id
                      )
                  : undefined
              }
            />
          ))}
        </div>
      )}
      {!error && invitees !== null && invitees.length > 0 ? (
        <p className='text-muted-foreground mt-3 text-xs'>
          {t('Showing {{count}} invitees', { count: invitees.length })}
          {cappedLimit > 0 && total >= cappedLimit
            ? ` · ${t('Limited to the most recent {{limit}} invitees', { limit: cappedLimit })}`
            : ''}
        </p>
      ) : null}
      {isAdmin ? (
        <p className='text-muted-foreground mt-1 text-xs'>
          {t(
            "As an administrator, you can expand a row to view that user's invite details."
          )}
        </p>
      ) : null}
    </TitledCard>
  )
}
