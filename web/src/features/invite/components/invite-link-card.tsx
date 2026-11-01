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
import { Download, Link2, Share2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
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
  const qrWrapperRef = useRef<HTMLDivElement>(null)

  /** Render the live QR SVG onto a white canvas and download it as PNG. */
  const handleSaveQrCode = () => {
    const svg = qrWrapperRef.current?.querySelector('svg')
    if (!svg) return
    const serialized = new XMLSerializer().serializeToString(svg)
    if (!serialized.includes('xmlns="http://www.w3.org/2000/svg"')) {
      // qrcode.react omits xmlns in some builds; the image loader needs it.
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    }
    const svgUrl = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(svg)], {
        type: 'image/svg+xml;charset=utf-8',
      })
    )
    const img = new Image()
    img.addEventListener(
      'load',
      () => {
        const size = 512
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(svgUrl)
          return
        }
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, size, size)
        ctx.drawImage(img, 0, 0, size, size)
        URL.revokeObjectURL(svgUrl)
        canvas.toBlob((blob) => {
          if (!blob) return
          const pngUrl = URL.createObjectURL(blob)
          const anchor = document.createElement('a')
          anchor.href = pngUrl
          anchor.download = `invite-qr-${affiliateCode || 'code'}.png`
          anchor.click()
          URL.revokeObjectURL(pngUrl)
        }, 'image/png')
      },
      { once: true }
    )
    img.src = svgUrl
  }

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

            {affiliateLink ? (
              <CopyButton
                value={affiliateLink}
                variant='default'
                size='lg'
                className='h-10 w-full text-sm font-semibold sm:w-auto'
                iconClassName='size-4'
                tooltip={t('Copy referral link')}
                aria-label={t('Copy referral link')}
              >
                {t('Copy invite link')}
              </CopyButton>
            ) : null}
          </div>

          {affiliateLink ? (
            <div className='flex flex-col items-center gap-2 self-center md:self-auto'>
              <div
                ref={qrWrapperRef}
                className='relative rounded-xl border bg-white p-3 shadow-sm'
              >
                <QRCodeSVG value={affiliateLink} size={148} />
                <span className='bg-primary text-primary-foreground absolute -top-2 -right-2 grid size-7 place-items-center rounded-full shadow'>
                  <Share2 className='size-3.5' />
                </span>
              </div>
              <p className='text-muted-foreground text-center text-xs'>
                {t('Scan the QR code to sign up with your invite link')}
              </p>
              <Button
                variant='outline'
                size='sm'
                className='w-full'
                onClick={handleSaveQrCode}
              >
                <Download className='size-3.5' />
                {t('Save invite QR code')}
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </TitledCard>
  )
}
