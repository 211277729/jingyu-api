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
import { Bell, Megaphone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { RichContent } from '@/components/rich-content'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import type { AnnouncementItem } from '@/features/dashboard/types'
import { getAnnouncementKey, useNotifications } from '@/hooks/use-notifications'
import { getAnnouncementColorClass } from '@/lib/colors'
import { formatDateTimeObject } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useNotificationStore } from '@/stores/notification-store'

/**
 * 全局公告弹窗：登录后检测到未读内容时在屏幕中央弹出。
 *
 * 内容分两段：最前面是系统公告（Notice，单条必读），其后是按发布时间倒序的
 * 未读公告（Announcements）。数据复用 useNotifications 的共享查询缓存。
 *
 * - 「知道了」把系统公告和当前公告全部标记为已读（与铃铛通知中心一致）；
 * - 「今日关闭」/ 右上角关闭 = 当天不再自动弹出，未读状态保留在铃铛里；
 * - 弹出状态持久化在 notification-store（localStorage），每条内容只弹一次。
 */
export function AnnouncementPopupDialog() {
  const { t } = useTranslation()
  const { notice, announcements, loading, unreadNoticeCount } =
    useNotifications()
  const {
    readAnnouncementKeys,
    markNoticeRead,
    markAnnouncementsRead,
    setClosedUntilDate,
    isNoticeClosed,
  } = useNotificationStore()

  const [open, setOpen] = useState(false)
  // 本次布局生命周期内用户已手动关闭过，避免数据刷新后再次自动弹出
  const [dismissed, setDismissed] = useState(false)

  // 系统公告非空且内容与上次已读不一致时视为未读
  const hasUnreadNotice = Boolean(notice) && unreadNoticeCount > 0

  // 未读公告，按发布时间倒序，最新的展示在最前面
  const unreadAnnouncements = useMemo(
    () =>
      (announcements as unknown as AnnouncementItem[])
        .filter(
          (item) =>
            !readAnnouncementKeys.includes(
              getAnnouncementKey(item as unknown as Record<string, unknown>)
            )
        )
        .sort(
          (a, b) =>
            new Date(b.publishDate || 0).getTime() -
            new Date(a.publishDate || 0).getTime()
        ),
    [announcements, readAnnouncementKeys]
  )

  useEffect(() => {
    if (loading || dismissed || open) return
    if (!hasUnreadNotice && unreadAnnouncements.length === 0) return
    if (isNoticeClosed()) return
    setOpen(true)
  }, [loading, dismissed, open, hasUnreadNotice, unreadAnnouncements, isNoticeClosed])

  // 今日关闭：当天不再自动弹出，未读角标仍保留
  const handleCloseToday = () => {
    setClosedUntilDate(new Date().toDateString())
    setDismissed(true)
    setOpen(false)
  }

  // 知道了：系统公告 + 当前公告全部标记为已读
  const handleAcknowledge = () => {
    if (notice) {
      markNoticeRead(notice)
    }
    if (announcements.length > 0) {
      markAnnouncementsRead(
        (announcements as Record<string, unknown>[]).map((item) =>
          getAnnouncementKey(item)
        )
      )
    }
    setDismissed(true)
    setOpen(false)
  }

  const unreadTotal =
    (hasUnreadNotice ? 1 : 0) + unreadAnnouncements.length

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) return
        handleCloseToday()
      }}
      title={t('Announcements')}
      description={t('{{count}} new announcement(s)', { count: unreadTotal })}
      contentClassName='sm:max-w-lg'
      contentHeight='auto'
      bodyClassName='space-y-4'
      showCloseButton
      footer={
        <>
          <Button variant='ghost' onClick={handleCloseToday}>
            {t('Close Today')}
          </Button>
          <Button onClick={handleAcknowledge}>{t('Got it')}</Button>
        </>
      }
    >
      <ScrollArea className='max-h-[min(58vh,520px)] pr-4'>
        <div className='space-y-5'>
          {hasUnreadNotice && (
            <section className='space-y-2'>
              <div className='flex items-center gap-2 text-sm font-medium'>
                <Bell className='size-4 shrink-0' />
                {t('System Notice')}
                <Badge>{t('Must-read')}</Badge>
              </div>
              <RichContent breaks content={notice} />
            </section>
          )}
          {hasUnreadNotice && unreadAnnouncements.length > 0 && (
            <Separator />
          )}
          {unreadAnnouncements.length > 0 && (
            <div className='space-y-5'>
              {hasUnreadNotice && (
                <div className='flex items-center gap-2 text-sm font-medium'>
                  <Megaphone className='size-4 shrink-0' />
                  {t('Announcements')}
                </div>
              )}
              {unreadAnnouncements.map((item, index) => (
                <div
                  key={
                    getAnnouncementKey(
                      item as unknown as Record<string, unknown>
                    ) || index
                  }
                  className='space-y-2'
                >
                  <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <span
                      className={cn(
                        'inline-block size-2 shrink-0 rounded-full',
                        getAnnouncementColorClass(item.type)
                      )}
                    />
                    {item.publishDate
                      ? formatDateTimeObject(new Date(item.publishDate))
                      : null}
                  </div>
                  <RichContent breaks content={item.content} />
                  {item.extra && (
                    <RichContent
                      breaks
                      content={item.extra}
                      className='text-muted-foreground'
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </Dialog>
  )
}
