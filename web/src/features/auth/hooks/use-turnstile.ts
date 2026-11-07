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
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { useStatus } from '@/hooks/use-status'

import { solvePoWChallenge } from '../lib/pow-solver'

/**
 * Hook for managing human verification: Cloudflare Turnstile or the
 * self-hosted PoW proof-of-work, selected by the backend captcha_provider.
 *
 * Token 名称沿用 turnstileToken，两种方式都以 query 参数 turnstile 提交。
 * PoW 模式下挂载后自动在后台求解，token 就绪后由各表单正常提交。
 */
export function useTurnstile() {
  const { status } = useStatus()
  const [turnstileToken, setTurnstileToken] = useState('')

  const captchaProvider = status?.captcha_provider || 'none'
  const isTurnstileEnabled =
    captchaProvider === 'pow' ||
    !!(status?.turnstile_check && status?.turnstile_site_key)
  const turnstileSiteKey = status?.turnstile_site_key || ''
  // 仅 Turnstile 需要渲染可见组件；PoW 在后台自动完成。
  const showTurnstileWidget = isTurnstileEnabled && captchaProvider !== 'pow'

  // PoW：无可用 token 时自动取挑战并求解；提交消费掉 token 后
  // （表单会 setTurnstileToken('')），effect 重新触发再解一个。
  useEffect(() => {
    if (captchaProvider !== 'pow' || turnstileToken) {
      return
    }
    const signal = { cancelled: false }
    solvePoWChallenge(signal)
      .then((token) => {
        if (!signal.cancelled) {
          setTurnstileToken(token)
        }
      })
      .catch(() => {
        // 取消或不可恢复错误：静默放弃，下次 token 变化时重试。
      })
    return () => {
      signal.cancelled = true
    }
  }, [captchaProvider, turnstileToken])

  /**
   * Validate if captcha is ready when required
   */
  const validateTurnstile = (): boolean => {
    if (isTurnstileEnabled && !turnstileToken) {
      toast.info(
        i18next.t('Please wait a moment, human check is initializing...')
      )
      return false
    }
    return true
  }

  return {
    captchaProvider,
    isTurnstileEnabled,
    showTurnstileWidget,
    turnstileSiteKey,
    turnstileToken,
    setTurnstileToken,
    validateTurnstile,
  }
}
