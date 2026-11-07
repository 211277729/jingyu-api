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
import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { RichContent } from '@/components/rich-content'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import type { AnnouncementItem } from '@/features/dashboard/types'
import { getAnnouncementKey, useNotifications } from '@/hooks/use-notifications'
import { getAnnouncementColorClass } from '@/lib/colors'
import { formatDateTimeObject } from '@/lib/time'
import { cn } from '@/lib/utils'
import { useNotificationStore } from '@/stores/notification-store'

// 时间线分页渲染：Markdown（shiki 高亮）渲染开销大，首屏只渲染一部分
const TIMELINE_PAGE_SIZE = 5
// 滚动到距底部该像素内即视为触底，避免用户必须精确滚到最后一像素
const SCROLL_BOTTOM_THRESHOLD_PX = 32
// 触底后额外允许的上滚余量：按钮渲染/卸载会改变 scrollHeight，若无迟滞，
// 在阈值附近滚动会造成按钮闪烁；超过「阈值+迟滞」才认为用户真的离开了底部
const SCROLL_BOTTOM_HYSTERESIS_PX = 64

/**
 * 全局公告弹窗：登录后检测到未读内容时在屏幕中央弹出。
 *
 * 弹窗内容默认展示完整公告时间线（按发布时间倒序，未读高亮），
 * 系统公告（Notice，必读）始终置顶，数据复用 useNotifications 的共享查询缓存。
 *
 * 加载优化：公告列表来自 /api/status 的 localStorage 快照，弹窗即点即开；
 * 系统公告请求独立加载，用骨架占位不阻塞弹窗打开；时间线分页渲染正文。
 *
 * - 「知道了」/ 右上角 × / ESC / 点击遮罩关闭：把系统公告和当前公告全部
 *   标记为已读（与铃铛通知中心一致）；
 * - 「今日关闭」= 当天不再因「关闭时已知的内容」自动弹出，未读状态保留在
 *   铃铛里；关闭后新发布的公告仍会照常弹出；
 * - 弹出状态持久化在 notification-store（localStorage），每条内容只弹一次。
 */
export function AnnouncementPopupDialog() {
  const { t } = useTranslation()
  const {
    notice,
    announcements,
    unreadNoticeCount,
    noticeLoading,
    statusLoading,
  } = useNotifications()
  const {
    readAnnouncementKeys,
    markNoticeRead,
    markAnnouncementsRead,
    setClosedUntilDate,
    isClosedToday,
  } = useNotificationStore()

  const [open, setOpen] = useState(false)
  // 本次布局生命周期内用户已手动关闭过，避免数据刷新后再次自动弹出
  const [dismissed, setDismissed] = useState(false)
  const [timelineCount, setTimelineCount] = useState(TIMELINE_PAGE_SIZE)
  // 「查看更多」不默认显示，用户把时间线滚到底部才出现
  const [timelineAtBottom, setTimelineAtBottom] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 系统公告非空且内容与上次已读不一致时视为未读
  const hasUnreadNotice = Boolean(notice) && unreadNoticeCount > 0

  // 公告时间线：全部公告按发布时间倒序；未读的在前端用圆点配色高亮
  const sortedAnnouncements = useMemo(
    () =>
      [...(announcements as unknown as AnnouncementItem[])].sort(
        (a, b) =>
          new Date(b.publishDate || 0).getTime() -
          new Date(a.publishDate || 0).getTime()
      ),
    [announcements]
  )

  const unreadAnnouncementsCount = useMemo(
    () =>
      sortedAnnouncements.filter(
        (item) =>
          !readAnnouncementKeys.includes(
            getAnnouncementKey(item as unknown as Record<string, unknown>)
          )
      ).length,
    [sortedAnnouncements, readAnnouncementKeys]
  )

  const isAnnouncementUnread = (item: AnnouncementItem) =>
    !readAnnouncementKeys.includes(
      getAnnouncementKey(item as unknown as Record<string, unknown>)
    )

  // 当前未读公告的 key 列表（含系统公告之外的全部未读项）
  const unreadAnnouncementKeys = useMemo(
    () =>
      sortedAnnouncements
        .map((item) =>
          getAnnouncementKey(item as unknown as Record<string, unknown>)
        )
        .filter((key) => !readAnnouncementKeys.includes(key)),
    [sortedAnnouncements, readAnnouncementKeys]
  )

  useEffect(() => {
    if (dismissed || open) return
    // 「今日关闭」只压制关闭时已知的内容；出现新公告后当天仍会弹出
    if (isClosedToday(unreadAnnouncementKeys)) return
    // 公告列表随 /api/status 快照立即可用，有未读公告即弹；
    // 系统公告未返回时先不阻塞，返回后未读会追加在弹窗顶部
    if (unreadAnnouncementsCount > 0 && !statusLoading) {
      setOpen(true)
      return
    }
    if (noticeLoading) return
    if (hasUnreadNotice) setOpen(true)
  }, [
    dismissed,
    open,
    isClosedToday,
    unreadAnnouncementKeys,
    unreadAnnouncementsCount,
    statusLoading,
    noticeLoading,
    hasUnreadNotice,
  ])

  // 打开时把滚动条强制回到顶部，避免焦点移动等浏览器行为把内容滚到底部；
  // 触底状态同步复位，「查看更多」重新回到隐藏
  useEffect(() => {
    if (!open) return
    setTimelineAtBottom(false)
    const raf = requestAnimationFrame(() => {
      document
        .querySelectorAll<HTMLElement>(
          '[data-slot=dialog-content], [data-slot=announcement-popup-scroll]'
        )
        .forEach((el) => {
          el.scrollTop = 0
        })
    })
    return () => cancelAnimationFrame(raf)
  }, [open])

  // 滚动触底检测：距底部不足阈值即认为到底，「查看更多」才允许出现；
  // 已触底时须上滚超过迟滞余量才隐藏，避免按钮自身的渲染/卸载引起闪烁
  const handleTimelineScroll = (event: UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceToBottom <= SCROLL_BOTTOM_THRESHOLD_PX) {
      setTimelineAtBottom(true)
    } else if (
      timelineAtBottom &&
      distanceToBottom >
        SCROLL_BOTTOM_THRESHOLD_PX + SCROLL_BOTTOM_HYSTERESIS_PX
    ) {
      setTimelineAtBottom(false)
    }
  }

  // 按钮刚触底出现时把滚动条吸附到底，让它完整露出而不是半截压在视口下沿
  useEffect(() => {
    if (!open || !timelineAtBottom) return
    const el = scrollRef.current
    if (!el) return
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
    return () => cancelAnimationFrame(raf)
  }, [open, timelineAtBottom])

  // 今日关闭：当天不再因「已知内容」自动弹出，未读角标仍保留；
  // 关闭后新发布的公告不受影响，仍会照常弹出
  const handleCloseToday = () => {
    setClosedUntilDate(new Date().toDateString(), unreadAnnouncementKeys)
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

  const unreadTotal = (hasUnreadNotice ? 1 : 0) + unreadAnnouncementsCount
  const visibleAnnouncements = sortedAnnouncements.slice(0, timelineCount)
  const hasMoreAnnouncements =
    sortedAnnouncements.length > visibleAnnouncements.length

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) return
        // 右上角 × / ESC / 点击遮罩关闭都按「知道了」处理：内容视为已读
        handleAcknowledge()
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
      {/* 不用 ScrollArea：Root 只有 max-h 时 Viewport 会被内容撑开并溢出到外层
          dialog-content，系统公告异步加载后外层滚动条会被带过头；普通 div 的
          max-h + overflow-y-auto 自带约束，滚动始终发生在自身。 */}
      <div
        ref={scrollRef}
        data-slot='announcement-popup-scroll'
        onScroll={handleTimelineScroll}
        className='max-h-[min(58vh,520px)] overflow-y-auto overscroll-contain pr-4'
      >
        <div className='space-y-5'>
          {noticeLoading ? (
            <div className='space-y-2'>
              <Skeleton className='h-4 w-24' />
              <Skeleton className='h-4 w-full' />
              <Skeleton className='h-4 w-2/3' />
            </div>
          ) : (
            hasUnreadNotice && (
              <section className='space-y-2'>
                <div className='flex items-center gap-2 text-sm font-medium'>
                  <Bell className='size-4 shrink-0' />
                  {t('System Notice')}
                  <Badge>{t('Must-read')}</Badge>
                </div>
                <RichContent breaks content={notice} />
              </section>
            )
          )}
          {hasUnreadNotice && sortedAnnouncements.length > 0 && <Separator />}
          {sortedAnnouncements.length > 0 && (
            <div className='space-y-5'>
              {hasUnreadNotice && (
                <div className='flex items-center gap-2 text-sm font-medium'>
                  <Megaphone className='size-4 shrink-0' />
                  {t('Announcements')}
                </div>
              )}
              {visibleAnnouncements.map((item, index) => {
                const unread = isAnnouncementUnread(item)
                return (
                  <div
                    key={
                      getAnnouncementKey(
                        item as unknown as Record<string, unknown>
                      ) || index
                    }
                    className='space-y-2'
                  >
                    <div
                      className={cn(
                        'flex items-center gap-2 text-sm',
                        unread ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block size-2 shrink-0 rounded-full',
                          unread
                            ? getAnnouncementColorClass(item.type)
                            : 'bg-muted-foreground/30'
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
                )
              })}
              {/* 「查看更多」作为列表最后一项放在滚动容器内：出现/消失都在
                  max-h 滚动区内部，不会引起弹窗高度抖动；仅在滚动触底后渲染，
                  此时用户已在底部，即使被焦点管理聚焦也不会再把时间线滚走 */}
              {hasMoreAnnouncements && timelineAtBottom && (
                <Button
                  variant='ghost'
                  size='sm'
                  className='w-full'
                  onClick={() => {
                    setTimelineCount((count) => count + TIMELINE_PAGE_SIZE)
                    setTimelineAtBottom(false)
                  }}
                >
                  {t('Show more announcements')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  )
}
