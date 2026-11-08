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
import type { TFunction } from 'i18next'
import { z } from 'zod'

import { RESOURCE_FORM_DEFAULT_VALUES, RESOURCE_LIMITS } from '../constants'
import type {
  ResourceAdminItem,
  ResourceFormValues,
  ResourcePayload,
} from '../types'

/** 逗号（中英文皆可）分隔 → 去空去重的标签数组 */
export function splitTags(value: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const piece of value.split(/[,，]/)) {
    const tag = piece.trim()
    if (!tag || seen.has(tag)) continue
    seen.add(tag)
    result.push(tag)
  }
  return result
}

/** 每行一条 → 数组（亮点、MCP 参数共用） */
export function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/** KEY=VALUE 每行一条 → env 对象；格式不对的行直接忽略，避免整单提交失败 */
export function parseEnvLines(
  value: string
): Record<string, string> | undefined {
  const entries: [string, string][] = []
  for (const line of splitLines(value)) {
    const index = line.indexOf('=')
    if (index <= 0) continue
    const key = line.slice(0, index).trim()
    const envValue = line.slice(index + 1).trim()
    if (!key) continue
    entries.push([key, envValue])
  }
  if (entries.length === 0) return undefined
  return Object.fromEntries(entries)
}

/** env 对象 → 表单文本（每行 KEY=VALUE） */
function formatEnvLines(env?: Record<string, string>): string {
  if (!env) return ''
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}

/** 校验规则与服务端 validateResourcePayload 对齐（服务端仍然是最终闸门） */
export function getResourceFormSchema(t: TFunction) {
  const optionalUrl = z.string().refine((value) => {
    const trimmed = value.trim()
    if (!trimmed) return true
    if (trimmed.length > RESOURCE_LIMITS.urlMaxLen) return false
    try {
      const parsed = new URL(trimmed)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }, t('Links must be full http(s) URLs'))

  return z
    .object({
      slug: z
        .string()
        .trim()
        .min(1, t('Slug is required'))
        .max(RESOURCE_LIMITS.slugMaxLen, t('Slug is too long'))
        .regex(
          /^[a-z0-9][a-z0-9-]*$/,
          t('Slug can only contain lowercase letters, digits and hyphens')
        ),
      name: z
        .string()
        .trim()
        .min(1, t('Name is required'))
        .max(RESOURCE_LIMITS.nameMaxLen, t('Name is too long')),
      kind: z.enum(['mcp', 'skill', 'agent-tool']),
      vendor: z.enum(['Official', 'Community']),
      icon_name: z.string().max(64, t('Icon name is too long')),
      tags: z.string(),
      summary_zh: z.string(),
      summary_en: z.string(),
      description_zh: z.string(),
      description_en: z.string(),
      highlights_zh: z.string(),
      highlights_en: z.string(),
      mcp_name: z.string(),
      mcp_command: z.string(),
      mcp_args: z.string(),
      mcp_env: z.string(),
      // 正文不设上限：技能正文本来就是一份完整 Markdown 文档
      content: z.string(),
      install_command: z.string(),
      download_url: optionalUrl,
      repo_url: optionalUrl,
      sort_order: z
        .number()
        .min(0, t('Sort order must be zero or greater'))
        .max(RESOURCE_LIMITS.sortOrderMax, t('Sort order is too large')),
      enabled: z.boolean(),
    })
    .refine(
      (values) =>
        values.summary_zh.trim() !== '' || values.summary_en.trim() !== '',
      {
        message: t(
          'At least one of the Chinese or English summary is required'
        ),
        path: ['summary_zh'],
      }
    )
    .refine(
      (values) => values.kind !== 'mcp' || values.mcp_command.trim() !== '',
      {
        message: t('MCP servers require a launch command'),
        path: ['mcp_command'],
      }
    )
}

export type ResourceFormSchema = ReturnType<typeof getResourceFormSchema>

/** 条目 → 表单默认值（多值字段拼成文本） */
export function toResourceFormValues(
  row: ResourceAdminItem
): ResourceFormValues {
  return {
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    vendor: row.vendor,
    icon_name: row.icon_name ?? '',
    tags: (row.tags ?? []).join(', '),
    summary_zh: row.summary?.zh ?? '',
    summary_en: row.summary?.en ?? '',
    description_zh: row.description?.zh ?? '',
    description_en: row.description?.en ?? '',
    highlights_zh: (row.highlights?.zh ?? []).join('\n'),
    highlights_en: (row.highlights?.en ?? []).join('\n'),
    mcp_name: row.mcp?.name ?? '',
    mcp_command: row.mcp?.command ?? '',
    mcp_args: (row.mcp?.args ?? []).join('\n'),
    mcp_env: formatEnvLines(row.mcp?.env),
    content: row.content ?? '',
    install_command: row.install_command ?? '',
    download_url: row.download_url ?? '',
    repo_url: row.repo_url ?? '',
    sort_order: row.sort_order ?? 0,
    enabled: row.enabled,
  }
}

/** 表单值 → 提交体；id 为空表示新建 */
export function buildResourcePayload(
  values: ResourceFormValues,
  id?: number
): ResourcePayload {
  const slug = values.slug.trim()
  const payload: ResourcePayload = {
    slug,
    name: values.name.trim(),
    kind: values.kind,
    icon_name: values.icon_name.trim(),
    vendor: values.vendor,
    tags: splitTags(values.tags),
    summary_zh: values.summary_zh.trim(),
    summary_en: values.summary_en.trim(),
    description_zh: values.description_zh.trim(),
    description_en: values.description_en.trim(),
    highlights_zh: splitLines(values.highlights_zh),
    highlights_en: splitLines(values.highlights_en),
    content: values.content.trim(),
    install_command: values.install_command.trim(),
    download_url: values.download_url.trim(),
    repo_url: values.repo_url.trim(),
    sort_order: values.sort_order,
    enabled: values.enabled,
  }
  if (id && id > 0) payload.id = id
  if (values.kind === 'mcp') {
    payload.mcp = {
      name: values.mcp_name.trim() || slug,
      command: values.mcp_command.trim(),
      args: splitLines(values.mcp_args),
      env: parseEnvLines(values.mcp_env),
    }
  }
  return payload
}

/** 列表行 → 提交体：启用开关只管一个字段，其余原样回写（PUT 是全量更新） */
export function rowToPayload(
  row: ResourceAdminItem,
  overrides: Partial<ResourcePayload> = {}
): ResourcePayload {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    kind: row.kind,
    icon_name: row.icon_name ?? '',
    vendor: row.vendor,
    tags: row.tags ?? [],
    summary_zh: row.summary?.zh ?? '',
    summary_en: row.summary?.en ?? '',
    description_zh: row.description?.zh ?? '',
    description_en: row.description?.en ?? '',
    highlights_zh: row.highlights?.zh ?? [],
    highlights_en: row.highlights?.en ?? [],
    mcp: row.mcp,
    content: row.content ?? '',
    install_command: row.install_command ?? '',
    download_url: row.download_url ?? '',
    repo_url: row.repo_url ?? '',
    sort_order: row.sort_order ?? 0,
    enabled: row.enabled,
    ...overrides,
  }
}

export { RESOURCE_FORM_DEFAULT_VALUES }
