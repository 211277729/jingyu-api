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
import { useEffect, useState } from 'react'

import type { ComboboxInputOption } from '@/components/ui/combobox-input'
import { searchUsers } from '@/features/users/api'
import { useDebounce } from '@/hooks/use-debounce'

import { isApiSuccess } from '../api'

// ============================================================================
// User Suggestions Hook (admin billing history user filter)
// ============================================================================

const SUGGESTION_PAGE_SIZE = 10

/**
 * Search users by keyword for the billing history user filter suggestions.
 * Returns empty options while the keyword is blank.
 */
export function useUserSuggestions(keyword: string) {
  const debouncedKeyword = useDebounce(keyword)
  const [options, setOptions] = useState<ComboboxInputOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const trimmed = debouncedKeyword.trim()
    if (!trimmed) {
      setOptions([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    searchUsers({ keyword: trimmed, page_size: SUGGESTION_PAGE_SIZE })
      .then((response) => {
        if (cancelled) return
        if (isApiSuccess(response) && response.data) {
          setOptions(
            response.data.items.map((user) => ({
              value: String(user.id),
              label: formatUserOptionLabel(user),
            }))
          )
        } else {
          setOptions([])
        }
      })
      .catch(() => {
        if (!cancelled) setOptions([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [debouncedKeyword])

  return { options, loading }
}

function formatUserOptionLabel(user: User): string {
  let label = user.username
  if (user.display_name && user.display_name !== user.username) {
    label += `（${user.display_name}）`
  }
  return `${label} #${user.id}`
}
