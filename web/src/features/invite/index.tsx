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
import { getSelf } from '@/lib/api'
import { TransferDialog } from '@/features/wallet/components/dialogs/transfer-dialog'
import { useAffiliate, useTopupInfo } from '@/features/wallet/hooks'
import type { UserWalletData } from '@/features/wallet/types'

import { InviteLinkCard } from './components/invite-link-card'
import { InviteRewardsCard } from './components/invite-rewards-card'

/**
 * Standalone invite & rewards page.
 *
 * Surfaces the referral link, QR code, rewards stats and quota transfer
 * that previously lived only at the bottom of the wallet page, reusing
 * the same wallet APIs and data.
 */
export function Invite() {
  const { t } = useTranslation()
  const [user, setUser] = useState<UserWalletData | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)

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
              onTransfer={() => setTransferDialogOpen(true)}
            />
          </div>
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
