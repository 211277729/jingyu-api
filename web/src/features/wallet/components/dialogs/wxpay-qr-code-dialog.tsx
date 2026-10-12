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
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '../../lib'

interface WxPayQrCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  codeUrl: string | null
  orderId: string | null
  paymentAmount: number
}

/**
 * Renders the WeChat Pay Native QR code (code_url) for the user to scan.
 * Closing the dialog refreshes the balance so a completed payment is picked
 * up through the webhook settlement.
 */
export function WxPayQrCodeDialog(props: WxPayQrCodeDialogProps) {
  const { t } = useTranslation()

  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-sm'>
        <AlertDialogHeader>
          <AlertDialogTitle className='text-xl font-semibold'>
            {t('WeChat Pay')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              'Scan the QR code with WeChat to pay {{amount}}. The balance is added automatically after payment.',
              { amount: formatCurrency(props.paymentAmount) }
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className='flex flex-col items-center gap-3 py-2'>
          {props.codeUrl ? (
            <div className='rounded-lg border bg-white p-3'>
              <QRCodeSVG value={props.codeUrl} size={192} />
            </div>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {t('Failed to create the payment QR code')}
            </p>
          )}
          {props.orderId && (
            <p className='text-muted-foreground font-mono text-xs'>
              {t('Order number')}: {props.orderId}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
          >
            {t('Close')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
