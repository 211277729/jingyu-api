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
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NotificationState {
  // Last read Notice content signature (full trimmed message)
  lastReadNotice: string
  // Array of read announcement keys (id or content hash)
  readAnnouncementKeys: string[]
  // Date string of the last "Close Today" action
  closedUntilDate: string | null
  // Unread announcement keys at the moment of "Close Today"; only these stay
  // suppressed for the rest of the day, newer announcements still pop up
  closedAnnouncementKeys: string[]

  // Actions
  markNoticeRead: (noticeContent: string) => void
  markAnnouncementsRead: (keys: string[]) => void
  setClosedUntilDate: (date: string | null, closedKeys?: string[]) => void
  isAnnouncementRead: (key: string) => boolean
  isClosedToday: (announcementKeys: string[]) => boolean
}

/**
 * Notification store for tracking read status of Notice and Announcements
 * Persists to localStorage to maintain state across sessions
 */
export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      lastReadNotice: '',
      readAnnouncementKeys: [],
      closedUntilDate: null,
      closedAnnouncementKeys: [],

      markNoticeRead: (noticeContent: string) => {
        // Persist the full trimmed content so edits beyond 100 chars register
        const normalizedContent = noticeContent.trim()
        set({ lastReadNotice: normalizedContent })
      },

      markAnnouncementsRead: (keys: string[]) => {
        set((state) => ({
          readAnnouncementKeys: [
            ...new Set([...state.readAnnouncementKeys, ...keys]),
          ],
        }))
      },

      setClosedUntilDate: (date, closedKeys) => {
        set({
          closedUntilDate: date,
          closedAnnouncementKeys: date ? (closedKeys ?? []) : [],
        })
      },

      isAnnouncementRead: (key: string) => {
        return get().readAnnouncementKeys.includes(key)
      },

      // 当日已「今日关闭」且传入的公告 key 都是关闭时已知的内容时才抑制；
      // 出现快照之外的新公告时返回 false，让弹窗照常弹出
      isClosedToday: (announcementKeys: string[]) => {
        const { closedUntilDate, closedAnnouncementKeys } = get()
        if (!closedUntilDate) return false
        if (closedUntilDate !== new Date().toDateString()) return false
        return announcementKeys.every((key) =>
          closedAnnouncementKeys.includes(key)
        )
      },
    }),
    {
      name: 'notification-storage',
      partialize: (state) => ({
        lastReadNotice: state.lastReadNotice,
        readAnnouncementKeys: state.readAnnouncementKeys,
        closedUntilDate: state.closedUntilDate,
        closedAnnouncementKeys: state.closedAnnouncementKeys,
      }),
    }
  )
)
