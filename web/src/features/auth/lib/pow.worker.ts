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
import { sha256 } from 'js-sha256'

interface SolveRequest {
  challenge: string
  difficulty: number
}

interface SolveResponse {
  nonce: string
}

function countLeadingZeroBits(bytes: ArrayLike<number>): number {
  let bits = 0
  for (let i = 0; i < bytes.length; i++) {
    let b = bytes[i]
    if (b === 0) {
      bits += 8
      continue
    }
    while ((b & 0x80) === 0) {
      bits++
      b <<= 1
    }
    break
  }
  return bits
}

self.addEventListener('message', (event: MessageEvent<SolveRequest>) => {
  const { challenge, difficulty } = event.data
  const prefix = challenge + ':'
  // js-sha256 的同步接口在 worker 里跑，每秒可完成百万级摘要，
  // 不阻塞主线程；主线程通过 terminate(this) 取消过期求解。
  for (let i = 0; ; i++) {
    const nonce = String(i)
    if (countLeadingZeroBits(sha256.digest(prefix + nonce)) >= difficulty) {
      const response: SolveResponse = { nonce }
      self.postMessage(response)
      return
    }
  }
})
