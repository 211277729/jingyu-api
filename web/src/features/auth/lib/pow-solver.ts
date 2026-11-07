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
import { api } from '@/lib/http-client'

interface PoWChallengeResponse {
  success: boolean
  data: {
    challenge_id: string
    challenge: string
    difficulty: number
    expires_in: number
  }
}

interface SolveRequest {
  challenge: string
  difficulty: number
}

interface SolveResponse {
  nonce: string
}

const RETRY_DELAY_MS = 3000

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 取一个 PoW 挑战并在 Web Worker 里穷举 nonce。
 * 返回可直接放进 turnstile query 参数的 `challenge_id.nonce`；
 * 签发失败时按固定间隔重试，直到成功（页面离不开有效 token）。
 */
export async function solvePoWChallenge(signal?: {
  cancelled: boolean
}): Promise<string> {
  for (;;) {
    if (signal?.cancelled) {
      throw new Error('cancelled')
    }
    try {
      const res = await api.get<PoWChallengeResponse>('/api/captcha/pow', {
        skipErrorHandler: true,
      })
      const { challenge_id, challenge, difficulty } = res.data?.data ?? {}
      if (!challenge_id || !challenge || !difficulty) {
        throw new Error('invalid PoW challenge response')
      }
      const nonce = await solveInWorker({ challenge, difficulty }, signal)
      return `${challenge_id}.${nonce}`
    } catch (error) {
      if (signal?.cancelled) {
        throw error
      }
      await delay(RETRY_DELAY_MS)
    }
  }
}

function solveInWorker(
  request: SolveRequest,
  signal?: { cancelled: boolean }
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./pow.worker.ts', import.meta.url), {
        type: 'module',
      })
    } catch (error) {
      reject(error)
      return
    }
    const cleanup = () => {
      worker.terminate()
    }
    worker.addEventListener(
      'message',
      (event: MessageEvent<SolveResponse>) => {
        cleanup()
        resolve(event.data.nonce)
      },
      { once: true }
    )
    worker.addEventListener(
      'error',
      (event) => {
        cleanup()
        reject(event.error ?? new Error('PoW worker failed'))
      },
      { once: true }
    )
    // 组件卸载/重新求解时由调用方标记取消，避免悬挂 worker。
    if (signal) {
      const check = setInterval(() => {
        if (signal.cancelled) {
          clearInterval(check)
          cleanup()
          reject(new Error('cancelled'))
        }
      }, 200)
      worker.addEventListener('message', () => clearInterval(check), {
        once: true,
      })
    }
    worker.postMessage(request)
  })
}
