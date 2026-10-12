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
import i18next from 'i18next'
import { useState, useCallback } from 'react'

import { calculateWxPayAmount, requestWxPayPayment, isApiSuccess } from '../api'
import type { WxPayPaymentResponse } from '../types'

function getWxPayCodeUrl(response: WxPayPaymentResponse): string | null {
  const data = response?.data
  if (data && typeof data === 'object' && typeof data.code_url === 'string') {
    return data.code_url
  }
  return null
}

function getWxPayOrderId(response: WxPayPaymentResponse): string | null {
  const data = response?.data
  if (data && typeof data === 'object' && typeof data.order_id === 'string') {
    return data.order_id
  }
  return null
}

/**
 * Hook for official WeChat Pay Native flow: request a prepay order and expose
 * the QR code URL (code_url) plus the local order id for the wallet dialog.
 */
export function useWxPayPayment() {
  const [processing, setProcessing] = useState(false)
  const [codeUrl, setCodeUrl] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)

  const processWxPayPayment = useCallback(
    async (topupAmount: number): Promise<boolean> => {
      setProcessing(true)
      setCodeUrl(null)
      setOrderId(null)

      try {
        const response = await requestWxPayPayment({
          amount: Math.floor(topupAmount),
        })

        if (isApiSuccess(response)) {
          const nextCodeUrl = getWxPayCodeUrl(response)
          if (nextCodeUrl) {
            setCodeUrl(nextCodeUrl)
            setOrderId(getWxPayOrderId(response))
            return true
          }
        }
        return false
      } catch {
        return false
      } finally {
        setProcessing(false)
      }
    },
    []
  )

  const dismissWxPayQrCode = useCallback(() => {
    setCodeUrl(null)
    setOrderId(null)
  }, [])

  return {
    processing,
    codeUrl,
    orderId,
    processWxPayPayment,
    dismissWxPayQrCode,
    calculateAmount: calculateWxPayAmount,
    // Exposed so callers can show a translated fallback when the request
    // succeeded but no QR code URL was returned.
    noQrCodeMessage: i18next.t('Failed to create the payment QR code'),
  }
}
