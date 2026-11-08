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
/** 资源类别：MCP 服务器 / Agent 技能包 / Agent 工具 */
export type ResourceKind = 'mcp' | 'skill' | 'agent-tool'

/**
 * 双语文案：数据文件内置中英文，避免为条目内容制造海量 i18n key。
 * zh 覆盖 zhCN 与 zhTW，其余语言回落 en。
 */
export type LocalizedText = {
  zh: string
  en: string
}

export type LocalizedList = {
  zh: string[]
  en: string[]
}

export type ResourceItem = {
  /** 详情页 URL 标识，如 `mcp-fetch` */
  slug: string
  name: string
  kind: ResourceKind
  /**
   * `@lobehub/icons` 图标名；缺省时渲染首字母徽章，
   * 与导航页 site-card 的兜底约定一致。
   */
  iconName?: string
  /** 英文关键词标签，用于搜索匹配与筛选 chips，原样展示 */
  tags: string[]
  /** 来源属性，原文展示（复用 i18n key "Official"/"Community"） */
  vendor: 'Official' | 'Community'
  /** 卡片上的一句话简介 */
  summary: LocalizedText
  /** 详情页正文描述 */
  description: LocalizedText
  /** 详情页亮点列表 */
  highlights: LocalizedList
  /** 终端安装命令（MCP / CLI 工具），展示为可复制码块 */
  installCommand?: string
  /** 直接下载地址（技能包 / 桌面客户端） */
  downloadUrl?: string
  /** 开源仓库地址，供溯源 */
  repoUrl?: string
}
