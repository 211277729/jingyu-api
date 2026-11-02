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
import { Globe, Mail } from 'lucide-react'

import {
  IconDiscord,
  IconGithub,
  IconLinuxDo,
  IconTelegram,
  IconWeChat,
} from '@/assets/brand-icons'

/** Keys of `/api/status` flags that gate each provider's availability. */
export interface BindingStatusInfo {
  github_oauth?: boolean
  discord_oauth?: boolean
  oidc_enabled?: boolean
  wechat_login?: boolean
  telegram_oauth?: boolean
  linuxdo_oauth?: boolean
  custom_oauth_providers?: Array<{
    id: number
    name: string
    icon?: string
  }>
}

export interface BuiltinBindingPreset {
  /** Short key also used as the admin unbind `binding_type`. */
  key: string
  /** User schema field holding the bound identifier. */
  field: string
  label: string
  icon: React.ReactNode
  statusKey: keyof Omit<BindingStatusInfo, 'custom_oauth_providers'> | null
}

/** Providers managed by the admin binding-clear endpoint. */
export const BUILTIN_BINDINGS: ReadonlyArray<BuiltinBindingPreset> = [
  {
    key: 'email',
    field: 'email',
    label: 'Email',
    icon: <Mail className='h-4 w-4' />,
    statusKey: null,
  },
  {
    key: 'github',
    field: 'github_id',
    label: 'GitHub',
    icon: <IconGithub className='h-4 w-4' />,
    statusKey: 'github_oauth',
  },
  {
    key: 'discord',
    field: 'discord_id',
    label: 'Discord',
    icon: <IconDiscord className='h-4 w-4' />,
    statusKey: 'discord_oauth',
  },
  {
    key: 'wechat',
    field: 'wechat_id',
    label: 'WeChat',
    icon: <IconWeChat className='h-4 w-4' />,
    statusKey: 'wechat_login',
  },
  {
    key: 'oidc',
    field: 'oidc_id',
    label: 'OIDC',
    icon: <Globe className='h-4 w-4' />,
    statusKey: 'oidc_enabled',
  },
  {
    key: 'telegram',
    field: 'telegram_id',
    label: 'Telegram',
    icon: <IconTelegram className='h-4 w-4' />,
    statusKey: 'telegram_oauth',
  },
  {
    key: 'linuxdo',
    field: 'linux_do_id',
    label: 'LinuxDO',
    icon: <IconLinuxDo className='h-4 w-4' />,
    statusKey: 'linuxdo_oauth',
  },
]

/** Provider presets for third-party login identities (email excluded). */
export const THIRD_PARTY_BINDINGS = BUILTIN_BINDINGS.filter(
  (b) => b.key !== 'email'
)
