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
import { CheckCircle2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useRef, useState } from 'react'
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
import { getWxPayOrderStatus, isApiSuccess } from '../../api'
import { formatCurrency } from '../../lib'

const WX_PAY_STATUS_POLL_INTERVAL_MS = 3000
const WX_PAY_STATUS_POLL_MAX_ATTEMPTS = 100

interface WxPayQrCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  codeUrl: string | null
  orderId: string | null
  paymentAmount: number
  /** Called once when the polled order status turns settled. */
  onPaid?: () => void
}

/**
 * Renders the WeChat Pay Native QR code (code_url) for the user to scan.
 *
 * While open, the dialog polls the local order status: whenever the backend
 * settles the order (normally through the WeChat notify callback) the dialog
 * flips to a success state and closes itself. In local development the
 * callback cannot reach the server, so settlement happens through the admin
 * complete-order action and the poll picks it up the same way.
 */
export function WxPayQrCodeDialog(props: WxPayQrCodeDialogProps) {
  const { t } = useTranslation()
  const [paid, setPaid] = useState(false)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Keep the latest props in a ref so the poll interval callback always reads
  // fresh values without being re-registered on every render.
  const pollContextRef = useRef({
    open: props.open,
    orderId: props.orderId,
    onPaid: props.onPaid,
    onOpenChange: props.onOpenChange,
  })
  pollContextRef.current = {
    open: props.open,
    orderId: props.orderId,
    onPaid: props.onPaid,
    onOpenChange: props.onOpenChange,
  }

  useEffect(() => {
    if (!props.open) {
      setPaid(false)
      return
    }

    let attempts = 0
    let stopped = false

    const poll = async () => {
      if (stopped) return
      const context = pollContextRef.current
      if (context.orderId) {
        try {
          const response = await getWxPayOrderStatus(context.orderId)
          if (isApiSuccess(response) && response.data?.status === 'success') {
            setPaid(true)
            context.onPaid?.()
            // Give the user a moment to see the success state, then close.
            setTimeout(() => {
              if (!stopped) context.onOpenChange(false)
            }, 2000)
            return
          }
        } catch {
          // Transient network errors just mean this tick finds nothing.
        }
      }
      attempts++
      if (attempts < WX_PAY_STATUS_POLL_MAX_ATTEMPTS) {
        pollTimerRef.current = setTimeout(poll, WX_PAY_STATUS_POLL_INTERVAL_MS)
      }
    }

    pollTimerRef.current = setTimeout(poll, WX_PAY_STATUS_POLL_INTERVAL_MS)
    return () => {
      stopped = true
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [props.open])

  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent className='max-sm:w-[calc(100vw-1.5rem)] sm:max-w-sm'>
        <AlertDialogHeader>
          <AlertDialogTitle className='text-xl font-semibold'>
            {t('WeChat Pay')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {paid
              ? t('Payment successful. Your balance has been updated.')
              : t(
                  'Scan the QR code with WeChat to pay {{amount}}. This dialog closes automatically once the payment is confirmed.',
                  { amount: formatCurrency(props.paymentAmount) }
                )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className='flex flex-col items-center gap-3 py-2'>
          {paid && (
            <div className='flex flex-col items-center gap-2 py-8 text-green-600'>
              <CheckCircle2 className='h-16 w-16' />
              <span className='text-sm font-medium'>
                {t('Payment successful')}
              </span>
            </div>
          )}
          {!paid && props.codeUrl && (
            <div className='rounded-lg border bg-white p-3'>
              <QRCodeSVG value={props.codeUrl} size={192} />
            </div>
          )}
          {!paid && !props.codeUrl && (
            <p className='text-muted-foreground text-sm'>
              {t('Failed to create the payment QR code')}
            </p>
          )}
          {!paid && props.orderId && (
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
            {paid ? t('Done') : t('Close')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
