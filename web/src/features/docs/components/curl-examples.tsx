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
import { useTranslation } from 'react-i18next'

import { usePricingData } from '@/features/pricing/hooks/use-pricing-data'

import { CodeBlock } from './code-block'

export function CurlExamples(props: { baseUrl: string }) {
  const { t } = useTranslation()
  // Sharing the `pricing` query key means this reads the same cached response
  // the model list above already fetched.
  const { models } = usePricingData()
  const modelId = models[0]?.model_name ?? 'MODEL_ID'

  const chat = `curl ${props.baseUrl}/chat/completions \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelId}",
    "messages": [{ "role": "user", "content": "Hello" }]
  }'`

  const messages = `curl ${props.baseUrl}/messages \\
  -H "x-api-key: $API_KEY" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${modelId}",
    "max_tokens": 64,
    "messages": [{ "role": "user", "content": "Hello" }]
  }'`

  return (
    <div className='space-y-3'>
      <h3 className='text-sm font-semibold'>{t('Verify with cURL')}</h3>
      <CodeBlock label='curl' code={chat} />
      <CodeBlock label='curl' code={messages} />
      <p className='text-muted-foreground text-xs'>
        {t(
          'A 401 means the token is wrong; an insufficient balance error means the account has no quota left.'
        )}
      </p>
    </div>
  )
}
