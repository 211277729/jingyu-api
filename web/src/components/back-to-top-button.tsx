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
import { ArrowUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { prefersReducedMotion } from '@/lib/dom-utils'
import { cn } from '@/lib/utils'

/** Long pages only: the button earns its place once the hero is gone. */
const SHOW_AFTER_Y = 480

/**
 * 全站共用的「回到顶部」浮标（右下角）。
 *
 * 任何滚动超过一屏的公开页面直接渲染 `<BackToTopButton />` 即可，
 * 不要各自再写一份：位置、层级、动效偏好和无障碍标签都在这里统一。
 */
export function BackToTopButton(props: {
  /** 自定义出现阈值（px），默认 480 */
  showAfterY?: number
  className?: string
}) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const threshold = props.showAfterY ?? SHOW_AFTER_Y

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return (
    <button
      type='button'
      aria-label={t('Back to top')}
      tabIndex={visible ? 0 : -1}
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        })
      }
      className={cn(
        'bg-background ring-border/60 hover:text-primary hover:ring-primary/40 text-muted-foreground fixed bottom-5 end-5 z-30 flex size-10 items-center justify-center rounded-full shadow-md ring-1 transition-all duration-200 hover:-translate-y-0.5 focus-visible:ring-ring/40 focus-visible:ring-2 focus-visible:outline-none lg:bottom-8 lg:end-8',
        visible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-2 opacity-0',
        props.className
      )}
    >
      <ArrowUp aria-hidden='true' size={18} />
    </button>
  )
}
