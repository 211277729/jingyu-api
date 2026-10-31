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
import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { formatQuotaWithCurrency } from '@/lib/currency'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'

import { getCheckinStatus, performCheckin } from '../api'

interface UseCheckinOptions {
  /** Whether the check-in feature is enabled on the site */
  checkinEnabled: boolean
  turnstileEnabled: boolean
  turnstileSiteKey: string
  /** Month to query (YYYY-MM); defaults to the current month */
  month?: string
}

/**
 * Shared daily check-in state and action.
 *
 * Uses the same `['checkin-status', month]` query cache as the profile
 * calendar card, so a check-in performed here refreshes every mounted
 * check-in surface at once. The caller renders the returned Turnstile
 * dialog (see `CheckinButton`) with the `turnstile*` state from here.
 */
export function useCheckin(options: UseCheckinOptions) {
  const { checkinEnabled, turnstileEnabled, turnstileSiteKey, month } = options
  const { t } = useTranslation()

  const [checkinLoading, setCheckinLoading] = useState(false)
  const [turnstileModalVisible, setTurnstileModalVisible] = useState(false)
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0)

  const currentMonthStr = (() => {
    if (month) return month
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()

  const {
    data: checkinData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['checkin-status', currentMonthStr],
    queryFn: async () => {
      const res = await getCheckinStatus(currentMonthStr)
      if (res.success && res.data) {
        return res.data
      }
      throw createServerError(res, t('Failed to fetch checkin status'))
    },
    enabled: checkinEnabled,
    staleTime: 30000,
  })

  const checkedToday = checkinData?.stats?.checked_in_today === true

  const shouldTriggerTurnstile = useCallback(
    (message?: string) => {
      if (!turnstileEnabled) return false
      if (typeof message !== 'string') return true
      return message.includes('Turnstile')
    },
    [turnstileEnabled]
  )

  const doCheckin = useCallback(
    async (token?: string) => {
      setCheckinLoading(true)
      try {
        const res = await performCheckin(token)
        if (res.success && res.data) {
          toast.success(
            `${t('Check-in successful! Received')} ${formatQuotaWithCurrency(res.data.quota_awarded)}`
          )
          refetch()
          setTurnstileModalVisible(false)
        } else {
          if (!token && shouldTriggerTurnstile(res.message)) {
            if (!turnstileSiteKey) {
              toast.error(t('Turnstile is enabled but site key is empty.'))
              return
            }
            setTurnstileModalVisible(true)
            return
          }
          if (token && shouldTriggerTurnstile(res.message)) {
            setTurnstileWidgetKey((v) => v + 1)
          }
          handleServerError(res, t('Check-in failed'))
        }
      } catch (error) {
        handleServerError(error, t('Check-in failed'))
      } finally {
        setCheckinLoading(false)
      }
    },
    [refetch, shouldTriggerTurnstile, t, turnstileSiteKey]
  )

  return {
    checkinData,
    isLoading,
    refetch,
    checkedToday,
    doCheckin,
    checkinLoading,
    turnstileModalVisible,
    setTurnstileModalVisible,
    turnstileWidgetKey,
    setTurnstileWidgetKey,
  }
}
