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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { ResourcesProvider } = await import('../resources-provider')
const { ResourcesPrimaryButtons } = await import('../resources-primary-buttons')
const { ResourceMutateDrawer } = await import('../resource-mutate-drawer')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

/** 打开新建抽屉（表单默认 kind=mcp，所以会渲染 MCP 启动配置那一段） */
async function openCreateDrawer(): Promise<HTMLElement> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ResourcesProvider>
          <ResourcesPrimaryButtons />
          <ResourceMutateDrawer />
        </ResourcesProvider>
      </QueryClientProvider>
    </I18nextProvider>
  )

  fireEvent.click(screen.getByRole('button', { name: 'New resource' }))

  return waitFor(() => {
    const node = document.querySelector<HTMLElement>(
      '[data-slot="sheet-content"]'
    )
    if (!node) throw new Error('sheet content is not mounted yet')
    return node
  })
}

/** 当前抽屉里的全部字段 label */
function fieldLabels(): HTMLLabelElement[] {
  return [
    ...document.querySelectorAll<HTMLLabelElement>(
      'label[data-slot="form-label"]'
    ),
  ]
}

/** 带必填星号的 label 文本（去掉星号与多余空白，便于逐项断言） */
function requiredLabelTexts(): string[] {
  return fieldLabels()
    .filter((label) => label.querySelector('[data-slot="required-indicator"]'))
    .map((label) => label.textContent?.replace('*', '').trim() ?? '')
}

describe('ResourceMutateDrawer', () => {
  test('把新建抽屉放宽到 2xl，不再停在默认的 sm', async () => {
    const sheetContent = await openCreateDrawer()

    expect(sheetContent.className).toContain('sm:max-w-2xl')
    // tailwind-merge 必须让自定义宽度覆盖 Sheet 默认的 sm:max-w-sm，否则面板还是窄的
    expect(sheetContent.className).not.toContain('sm:max-w-sm')
  })

  test('必填项都带星号提示', async () => {
    await openCreateDrawer()

    expect(requiredLabelTexts()).toEqual([
      'Slug',
      'Name',
      'Kind',
      'Vendor',
      'Summary',
      'Summary',
      'Command',
    ])
  })

  test('可选字段不出现星号', async () => {
    await openCreateDrawer()

    const optionalLabels = fieldLabels()
      .filter(
        (label) => !label.querySelector('[data-slot="required-indicator"]')
      )
      .map((label) => label.textContent?.trim() ?? '')

    expect(optionalLabels).toContain('Icon')
    expect(optionalLabels).toContain('Sort order')
    expect(optionalLabels).toContain('Tags')
    // 正文是"有就显示"，不强制填
    expect(optionalLabels).toContain('Content')
  })

  test('正文支持 Markdown：可切到预览看到渲染结果', async () => {
    await openCreateDrawer()

    const textarea = document.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder^="## What this skill does"]'
    )
    expect(textarea).not.toBeNull()
    fireEvent.change(textarea as HTMLTextAreaElement, {
      target: { value: '## 快速开始\n\n- 第一步\n- 第二步' },
    })

    // 没切预览前是纯文本编辑框，没有渲染出的标题
    expect(screen.queryByRole('heading', { name: '快速开始' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

    expect(
      await screen.findByRole('heading', { name: '快速开始' })
    ).toBeInTheDocument()
    expect(screen.getByText('第一步')).toBeInTheDocument()
  })

  test('预览不会把栅格撑宽（切换按钮固定在右上角）', async () => {
    await openCreateDrawer()

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))

    // 栅格列必须被固定成 1fr 并允许收缩，否则宽表格 / 长代码行会把整行撑开
    const field = screen.getByText('Content').closest('[data-slot="form-item"]')
    expect(field?.className).toContain('grid-cols-1')
    expect(field?.className).toContain('min-w-0')
  })

  test('简介下面说明"中英至少填一项"', async () => {
    await openCreateDrawer()

    expect(
      screen.getAllByText(
        'At least one of the Chinese or English summary is required'
      )
    ).toHaveLength(1)
  })
})
