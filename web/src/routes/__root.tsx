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
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import {
  createRootRouteWithContext,
  Outlet,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useEffect } from 'react'

import { NavigationProgress } from '@/components/navigation-progress'
import { Toaster } from '@/components/ui/sonner'
import { ThemeCustomizationProvider } from '@/context/theme-customization-provider'
import { saveAffiliateCode } from '@/features/auth/lib/storage'
import { GeneralError } from '@/features/errors/general-error'
import { NotFoundError } from '@/features/errors/not-found-error'
import { getSetupStatus } from '@/features/setup/api'
import { useSystemConfig } from '@/hooks/use-system-config'
import {
  bootstrapAuthentication,
  clearAuthenticatedClientState,
  clearAuthentication,
} from '@/lib/auth-session'
import { subscribeAuthSessionEvents } from '@/lib/auth-session-sync'
import { resolveLegacyRoute } from '@/lib/legacy-route'
import { useAuthStore } from '@/stores/auth-store'

function RootComponent() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Load system configuration (logo, system name, etc.) from backend
  useSystemConfig({ autoLoad: true })

  useEffect(() => {
    const aff = new URLSearchParams(window.location.search).get('aff')?.trim()
    if (aff) {
      saveAffiliateCode(aff)
    }
  }, [])

  useEffect(
    () =>
      useAuthStore.subscribe((state, previousState) => {
        const sid = state.auth.session?.sid
        const previousSID = previousState.auth.session?.sid
        if (sid !== previousSID) {
          queryClient.clear()
        }
      }),
    [queryClient]
  )

  useEffect(
    () =>
      subscribeAuthSessionEvents((event) => {
        const currentSID = useAuthStore.getState().auth.session?.sid

        if (event.kind === 'authenticated') {
          if (event.sid === currentSID) return
          if (currentSID) {
            clearAuthentication(false)
          }
          window.location.reload()
          return
        }

        if (currentSID && event.sid === currentSID) {
          clearAuthenticatedClientState(queryClient, false)
          void navigate({ to: '/sign-in', replace: true })
        }
      }),
    [navigate, queryClient]
  )

  return (
    <ThemeCustomizationProvider>
      <NavigationProgress />
      <Outlet />
      <Toaster closeButton duration={5000} position='top-center' richColors />
      {import.meta.env.MODE === 'development' && (
        <>
          <ReactQueryDevtools buttonPosition='bottom-left' />
          <TanStackRouterDevtools position='bottom-right' />
          <DevtoolsCloseFix />
        </>
      )}
    </ThemeCustomizationProvider>
  )
}

// 开发模式专用补丁：devtools 面板用 Solid 实现，靠 document 级委托响应面板内点击；
// 真实鼠标操作时 mousedown / mouseup 的命中目标在面板上下边缘常不一致，click 被浏览器
// 合成到共同祖先上，面板收不到自己的「× 收起」「顶部 logo」等点击，表现为关不掉。
// pointerdown 的命中目标始终准确，这里在 pointerup 后检测两端目标是否漂移，漂移时以
// mousedown 时的目标元素补发一次 click。仅修补面板区域（router + query），不渲染内容。
function DevtoolsCloseFix() {
  useEffect(() => {
    const devtoolsRootQuery = '.TanStackRouterDevtools, .tsqd-parent-container'
    let downTarget: Element | null = null

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      downTarget =
        target instanceof Element && target.closest(devtoolsRootQuery)
          ? target
          : null
    }

    const onPointerUp = (event: PointerEvent) => {
      const target = event.target
      const drifted =
        downTarget?.isConnected &&
        target instanceof Element &&
        !downTarget.contains(target) &&
        !target.contains(downTarget)
      if (downTarget && drifted) {
        downTarget.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            clientX: event.clientX,
            clientY: event.clientY,
          }),
        )
      }
      downTarget = null
    }

    // 清理历史遗留的「卡在打开」状态；正常开合写入的 false 不受影响
    if (localStorage.getItem('tanstackRouterDevtoolsOpen') === 'true') {
      localStorage.removeItem('tanstackRouterDevtoolsOpen')
    }

    // 面板关闭走 0.4s 整宽下滑动画，观感上「抬一下、占满全宽才收走」；这里直接禁掉
    // 该过渡，让开合瞬时完成（拖拽调高不受影响，拖拽本身就不走这个过渡）。
    let styleElement = document.querySelector<HTMLStyleElement>(
      '#devtools-close-fix-style',
    )
    if (!styleElement) {
      styleElement = document.createElement('style')
      styleElement.id = 'devtools-close-fix-style'
      styleElement.textContent = `
        .TanStackRouterDevtoolsPanel { transition: none !important; }
      `
      document.head.appendChild(styleElement)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointerup', onPointerUp, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      styleElement?.remove()
    }
  }, [])

  return null
}

// 同一页面会话内避免重复检查；刷新后重新校验当前服务实例。
let setupStatusChecked = false

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  // 应用初始化与路由解析前统一校验会话
  beforeLoad: async ({ location }) => {
    const legacyTarget = resolveLegacyRoute(location.href)
    if (legacyTarget) {
      throw redirect({ href: legacyTarget, replace: true })
    }

    const pathname = location?.pathname || ''
    const needsSetupCheck =
      !setupStatusChecked && !pathname.startsWith('/setup')
    const authBootstrap = bootstrapAuthentication()

    // 只检查 setup 状态（如果需要）
    if (needsSetupCheck) {
      const [status] = await Promise.all([
        getSetupStatus().catch((error) => {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.warn('[root.beforeLoad] setup status check failed', error)
          }
          return null
        }),
        authBootstrap,
      ])

      if (status?.success && status.data) {
        if (!status.data.status) {
          throw redirect({ to: '/setup' })
        }
        setupStatusChecked = true
      }
    } else {
      await authBootstrap
    }
  },
  component: RootComponent,
  notFoundComponent: NotFoundError,
  errorComponent: GeneralError,
})
