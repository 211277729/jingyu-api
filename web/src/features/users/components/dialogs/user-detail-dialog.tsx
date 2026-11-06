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
import { Eye, Pencil, Link2, CreditCard, Wallet } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { UserSubscriptionsDialog } from '@/features/subscriptions/components/dialogs/user-subscriptions-dialog'
import { getCurrencyDisplay } from '@/lib/currency'
import { formatQuota, formatTimestampToDate } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import type { CustomOAuthBinding } from '@/lib/oauth'
import { requireServerSuccess } from '@/lib/server-error-message'

import { getUser, getUserOAuthBindings } from '../../api'
import {
  USER_STATUS,
  USER_STATUSES,
  USER_ROLES,
  isUserDeleted,
} from '../../constants'
import { THIRD_PARTY_BINDINGS } from '../../lib/binding-presets'
import type { User } from '../../types'
import { UserQuotaDialog } from '../user-quota-dialog'
import { useUsers } from '../users-provider'
import { UserBindingDialog } from './user-binding-dialog'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Row snapshot for instant paint; fresh data is fetched on open. */
  initialUser?: User | null
}

function DetailItem(props: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex items-start justify-between gap-4 py-1.5'>
      <span className='text-muted-foreground shrink-0 text-sm'>
        {props.label}
      </span>
      <div className='min-w-0 text-right text-sm break-all'>
        {props.children}
      </div>
    </div>
  )
}

export function UserDetailDialog(props: Props) {
  const { t } = useTranslation()
  const { setCurrentRow, setOpen, triggerRefresh } = useUsers()
  const [user, setUser] = useState<User | null>(null)
  const [oauthBindings, setOauthBindings] = useState<CustomOAuthBinding[]>([])
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false)
  const [bindingDialogOpen, setBindingDialogOpen] = useState(false)
  const [subscriptionsDialogOpen, setSubscriptionsDialogOpen] = useState(false)

  const { meta: currency } = getCurrencyDisplay()
  const quotaUnit = currency.kind === 'tokens' ? t('Tokens') : currency.symbol

  const refetchUser = useCallback(async () => {
    if (!props.initialUser?.id) return
    try {
      const [userRes, oauthRes] = await Promise.all([
        getUser(props.initialUser.id),
        getUserOAuthBindings(props.initialUser.id).catch(() => ({
          success: false,
          data: [],
        })),
      ])
      requireServerSuccess(userRes)
      if (userRes.success && userRes.data) {
        setUser(userRes.data)
      }
      if (oauthRes.success && oauthRes.data) {
        setOauthBindings(oauthRes.data)
      }
      triggerRefresh()
    } catch (error) {
      handleServerError(error, t('Failed to load'))
    }
  }, [props.initialUser?.id, t, triggerRefresh])

  useEffect(() => {
    if (props.open && props.initialUser) {
      setUser(props.initialUser)
      setOauthBindings([])
      refetchUser()
    } else if (!props.open) {
      setUser(null)
      setOauthBindings([])
      setQuotaDialogOpen(false)
      setBindingDialogOpen(false)
      setSubscriptionsDialogOpen(false)
    }
  }, [props.open, props.initialUser, refetchUser])

  const handleEdit = () => {
    if (!user) return
    props.onOpenChange(false)
    setCurrentRow(user)
    setOpen('update')
  }

  const handleControlSuccess = () => refetchUser()

  if (!props.initialUser) return null

  const deleted = isUserDeleted(props.initialUser)
  const statusConfig = deleted
    ? USER_STATUSES[USER_STATUS.DELETED]
    : USER_STATUSES[props.initialUser.status as keyof typeof USER_STATUSES]
  const roleConfig =
    USER_ROLES[props.initialUser.role as keyof typeof USER_ROLES]

  const boundBindings = THIRD_PARTY_BINDINGS.map((binding) => ({
    ...binding,
    value: String(
      (user as unknown as Record<string, unknown>)?.[binding.field] || ''
    ),
  })).filter((binding) => binding.value)

  const footerContent =
    user && !deleted ? (
      <>
        <Button size='sm' onClick={handleEdit}>
          <Pencil className='h-4 w-4' />
          {t('Edit')}
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={() => setQuotaDialogOpen(true)}
        >
          <Wallet className='h-4 w-4' />
          {t('Adjust Quota')}
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={() => setSubscriptionsDialogOpen(true)}
        >
          <CreditCard className='h-4 w-4' />
          {t('Manage Subscriptions')}
        </Button>
      </>
    ) : undefined

  return (
    <>
      <Dialog
        open={props.open}
        onOpenChange={props.onOpenChange}
        title={
          <>
            <Eye className='h-5 w-5' />
            {t('User Detail')}
          </>
        }
        description={t('View user information and manage the account')}
        contentClassName='sm:max-w-lg'
        titleClassName='flex items-center gap-2'
        descriptionClassName='sr-only'
        contentHeight='auto'
        bodyClassName='space-y-3'
        footer={footerContent}
      >
        {user ? (
          <ScrollArea className='max-h-[60vh]'>
            <div className='space-y-3 pr-3'>
              {/* Basic Information */}
              <div>
                <p className='mb-1 text-sm font-medium'>
                  {t('Basic Information')}
                </p>
                <DetailItem label={t('ID')}>
                  <span className='tabular-nums'>{user.id}</span>
                </DetailItem>
                <DetailItem label={t('Username')}>
                  <span className='font-medium'>{user.username}</span>
                </DetailItem>
                {user.display_name && (
                  <DetailItem label={t('Display Name')}>
                    {user.display_name}
                  </DetailItem>
                )}
                <DetailItem label={t('Status')}>
                  {statusConfig ? (
                    <StatusBadge
                      label={t(statusConfig.labelKey)}
                      variant={deleted ? 'neutral' : statusConfig.variant}
                      copyable={false}
                      size='sm'
                    />
                  ) : (
                    user.status
                  )}
                </DetailItem>
                <DetailItem label={t('Role')}>
                  {roleConfig ? t(roleConfig.labelKey) : user.role}
                </DetailItem>
                <DetailItem label={t('User Group')}>{user.group}</DetailItem>
                {user.remark && (
                  <DetailItem label={t('Remark')}>{user.remark}</DetailItem>
                )}
              </div>

              <Separator />

              {/* Contact Information */}
              <div>
                <p className='mb-1 text-sm font-medium'>
                  {t('Contact Information')}
                </p>
                <DetailItem label={t('Email')}>
                  {user.email ? (
                    user.email
                  ) : (
                    <span className='text-muted-foreground'>—</span>
                  )}
                </DetailItem>
                <DetailItem label={t('Phone')}>
                  {user.phone ? (
                    user.phone
                  ) : (
                    <span className='text-muted-foreground'>—</span>
                  )}
                </DetailItem>
              </div>

              <Separator />

              {/* Login Bindings */}
              <div>
                <p className='mb-1 text-sm font-medium'>
                  {t('Login Bindings')}
                </p>
                {boundBindings.length === 0 && oauthBindings.length === 0 ? (
                  <p className='text-muted-foreground py-2 text-sm'>
                    {t('This user has no bindings')}
                  </p>
                ) : (
                  <div className='space-y-1'>
                    {boundBindings.map((binding) => (
                      <div
                        key={binding.key}
                        className='flex items-center justify-between gap-4 py-1'
                      >
                        <span className='flex items-center gap-2 text-sm'>
                          <span className='text-muted-foreground'>
                            {binding.icon}
                          </span>
                          {binding.label}
                        </span>
                        <span className='min-w-0 truncate text-sm'>
                          {binding.value}
                        </span>
                      </div>
                    ))}
                    {oauthBindings.map((binding) => (
                      <div
                        key={`oauth_${binding.provider_id}`}
                        className='flex items-center justify-between gap-4 py-1'
                      >
                        <span className='flex items-center gap-2 text-sm'>
                          <span className='text-muted-foreground'>
                            <Link2 className='h-4 w-4' />
                          </span>
                          {binding.provider_name || String(binding.provider_id)}
                        </span>
                        <span className='min-w-0 truncate text-sm'>
                          {binding.provider_user_id || '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {!deleted && (
                  <Button
                    variant='outline'
                    size='sm'
                    className='mt-2'
                    onClick={() => setBindingDialogOpen(true)}
                  >
                    <Link2 className='h-4 w-4' />
                    {t('Manage Bindings')}
                  </Button>
                )}
              </div>

              <Separator />

              {/* Quota & Usage */}
              <div>
                <p className='mb-1 text-sm font-medium'>
                  {t('Quota & Usage')} ({quotaUnit})
                </p>
                <DetailItem label={t('Available Balance')}>
                  <span className='tabular-nums'>
                    {formatQuota(user.quota)}
                  </span>
                </DetailItem>
                <DetailItem label={t('Used Quota')}>
                  <span className='tabular-nums'>
                    {formatQuota(user.used_quota)}
                  </span>
                </DetailItem>
                <DetailItem label={t('Requests')}>
                  <span className='tabular-nums'>
                    {(user.request_count || 0).toLocaleString()}
                  </span>
                </DetailItem>
              </div>

              <Separator />

              {/* Invite Info */}
              <div>
                <p className='mb-1 text-sm font-medium'>{t('Invite Info')}</p>
                <DetailItem label={t('Invite Code')}>
                  {user.aff_code || (
                    <span className='text-muted-foreground'>—</span>
                  )}
                </DetailItem>
                <DetailItem label={t('Invited Users')}>
                  <span className='tabular-nums'>{user.aff_count || 0}</span>
                </DetailItem>
                <DetailItem label={t('Earnings')}>
                  <span className='tabular-nums'>
                    {formatQuota(user.aff_history_quota || 0)}
                  </span>
                </DetailItem>
                <DetailItem label={t('Inviter')}>
                  {user.inviter_id ? (
                    <span className='tabular-nums'>#{user.inviter_id}</span>
                  ) : (
                    <span className='text-muted-foreground'>—</span>
                  )}
                </DetailItem>
              </div>

              <Separator />

              {/* Time */}
              <div>
                <p className='mb-1 text-sm font-medium'>{t('Time')}</p>
                <DetailItem label={t('Created At')}>
                  {formatTimestampToDate(user.created_at)}
                </DetailItem>
                <DetailItem label={t('Last Login')}>
                  {formatTimestampToDate(user.last_login_at)}
                </DetailItem>
              </div>
            </div>
          </ScrollArea>
        ) : null}
      </Dialog>

      {user && (
        <>
          <UserQuotaDialog
            open={quotaDialogOpen}
            onOpenChange={setQuotaDialogOpen}
            userId={user.id}
            currentQuota={user.quota}
            onSuccess={handleControlSuccess}
          />
          <UserBindingDialog
            open={bindingDialogOpen}
            onOpenChange={setBindingDialogOpen}
            userId={user.id}
            onUnbindSuccess={handleControlSuccess}
          />
          <UserSubscriptionsDialog
            open={subscriptionsDialogOpen}
            onOpenChange={setSubscriptionsDialogOpen}
            user={{ id: user.id, username: user.username }}
            onSuccess={handleControlSuccess}
          />
        </>
      )}
    </>
  )
}
