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
import { Link2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { TitledCard } from '@/components/ui/titled-card'

interface InviteLinkCardProps {
  affiliateCode: string
  affiliateLink: string
  loading?: boolean
}

export function InviteLinkCard({
  affiliateCode,
  affiliateLink,
  loading,
}: InviteLinkCardProps) {
  const { t } = useTranslation()

  return (
    <TitledCard
      disableHoverEffect
      title={
        <span className='flex items-center gap-2'>
          <Link2 className='size-4' />
          {t('My invite link')}
        </span>
      }
    >
      {loading ? (
        <div className='space-y-4 p-4 sm:p-5'>
          <Skeleton className='h-10 rounded-lg' />
          <Skeleton className='h-40 w-full max-w-44 rounded-lg' />
        </div>
      ) : (
        <div className='grid gap-5 p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center'>
          <div className='min-w-0 space-y-4'>
            <div className='space-y-2'>
              <div className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                {t('Invite code')}
              </div>
              <div className='flex items-center gap-2'>
                <Input
                  value={affiliateCode}
                  readOnly
                  className='bg-background/70 h-10 min-w-0 flex-1 font-mono text-sm'
                />
                <CopyButton
                  value={affiliateCode}
                  variant='outline'
                  className='bg-background size-10 shrink-0'
                  iconClassName='size-4'
                  tooltip={t('Copy invite code')}
                  aria-label={t('Copy invite code')}
                />
              </div>
            </div>

            <div className='space-y-2'>
              <div className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
                {t('Invite link')}
              </div>
              <div className='flex items-center gap-2'>
                <Input
                  value={affiliateLink}
                  readOnly
                  className='bg-background/70 h-10 min-w-0 flex-1 font-mono text-xs'
                />
                <CopyButton
                  value={affiliateLink}
                  variant='outline'
                  className='bg-background size-10 shrink-0'
                  iconClassName='size-4'
                  tooltip={t('Copy referral link')}
                  aria-label={t('Copy referral link')}
                />
              </div>
            </div>
          </div>

          {affiliateLink ? (
            <div className='flex flex-col items-center gap-2 self-center md:self-auto'>
              <div className='rounded-lg border bg-white p-3'>
                <QRCodeSVG value={affiliateLink} size={148} />
              </div>
              <p className='text-muted-foreground text-center text-xs'>
                {t('Scan the QR code to sign up with your invite link')}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </TitledCard>
  )
}
