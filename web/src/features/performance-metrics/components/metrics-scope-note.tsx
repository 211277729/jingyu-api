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

import { cn } from '@/lib/utils'

import type { MetricsScope } from '../types'

// MetricsScopeNote states which request population the published speed numbers
// cover. An administrator can replace the sentence, but a scoped number is never
// shown without one, so readers can always tell what the figure measures.
export function MetricsScopeNote(props: {
  scope?: MetricsScope
  className?: string
}) {
  const { t } = useTranslation()
  if (!props.scope) {
    return null
  }
  const note = props.scope.note?.trim()
  if (note) {
    return (
      <p className={cn('text-muted-foreground text-xs', props.className)}>
        {note}
      </p>
    )
  }
  if (props.scope.mode === 'short' && props.scope.prompt_token_limit) {
    return (
      <p className={cn('text-muted-foreground text-xs', props.className)}>
        {t(
          'Latency and throughput cover standard chat requests (input ≤{{limit}} tokens) · last 24 hours',
          { limit: props.scope.prompt_token_limit }
        )}
      </p>
    )
  }
  return null
}
