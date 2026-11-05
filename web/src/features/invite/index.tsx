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

import { SectionPageLayout } from '@/components/layout'
import { TransferDialog } from '@/features/wallet/components/dialogs/transfer-dialog'
import { useAffiliate, useTopupInfo } from '@/features/wallet/hooks'
import type { UserWalletData } from '@/features/wallet/types'
import { useStatus } from '@/hooks/use-status'
import { getSelf } from '@/lib/api'

import { InviteHero } from './components/invite-hero'
import { InviteesCard } from './components/invite-invitees-card'
import { InviteLinkCard } from './components/invite-link-card'
import { InviteRewardsCard } from './components/invite-rewards-card'
import { InviteSteps } from './components/invite-steps'

/**
 * Standalone invite & rewards page.
 *
 * A marketing-styled funnel: gradient hero with the concrete reward amounts
 * from system settings, a three-step explainer, then the working cards
 * (invite link / QR, rewards stats and quota transfer) reusing the same
 * wallet APIs and data as before.
 */
export function Invite() {
  const { t } = useTranslation()
  const [user, setUser] = useState<UserWalletData | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)

  const { status } = useStatus()
  const inviterQuota = Number(status?.invite_inviter_quota ?? 0)
  const inviteeQuota = Number(status?.invite_invitee_quota ?? 0)
  // 邀请充值返利：好友充值到账后按百分比返给邀请人
  const rebateFirstPercent = Number(status?.aff_topup_rebate_first_percent ?? 0)
  const rebatePercent = Number(status?.aff_topup_rebate_percent ?? 0)
  const rebateFirstDays = Number(status?.aff_topup_rebate_first_days ?? 0)

  const {
    affiliateCode,
    affiliateLink,
    loading: affiliateLoading,
    transferQuota,
    transferring,
  } = useAffiliate()
  const { topupInfo } = useTopupInfo()

  const fetchUser = useCallback(async () => {
    try {
      setUserLoading(true)
      const response = await getSelf()
      if (response.success && response.data) {
        setUser(response.data as UserWalletData)
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch user data:', error)
    } finally {
      setUserLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  const handleTransfer = async (amount: number) => {
    const success = await transferQuota(amount)
    if (success) {
      await fetchUser()
    }
    return success
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Invite & Earn')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-5'>
          <InviteHero
            inviterQuota={inviterQuota}
            inviteeQuota={inviteeQuota}
            rebateFirstPercent={rebateFirstPercent}
            rebatePercent={rebatePercent}
            rebateFirstDays={rebateFirstDays}
          />
          <InviteSteps />
          <div className='grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] xl:items-start'>
            <InviteLinkCard
              affiliateCode={affiliateCode}
              affiliateLink={affiliateLink}
              loading={affiliateLoading}
            />
            <InviteRewardsCard
              user={user}
              loading={userLoading}
              transferring={transferring}
              complianceConfirmed={
                topupInfo?.payment_compliance_confirmed !== false
              }
              hasTopupRebate={rebateFirstPercent > 0 || rebatePercent > 0}
              onTransfer={() => setTransferDialogOpen(true)}
            />
          </div>
          <InviteesCard user={user} />
        </div>
      </SectionPageLayout.Content>

      <TransferDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        onConfirm={handleTransfer}
        availableQuota={user?.aff_quota ?? 0}
        transferring={transferring}
      />
    </SectionPageLayout>
  )
}
