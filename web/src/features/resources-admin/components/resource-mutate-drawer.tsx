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
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  SideDrawerSection,
  SideDrawerSectionHeader,
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
  sideDrawerSwitchItemClassName,
} from '@/components/drawer-layout'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Markdown } from '@/components/ui/markdown'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { handleServerError } from '@/lib/handle-server-error'

import {
  createResource,
  invalidatePublicResources,
  updateResource,
} from '../api'
import {
  RESOURCE_FORM_DEFAULT_VALUES,
  RESOURCE_KIND_OPTIONS,
  RESOURCE_VENDOR_OPTIONS,
} from '../constants'
import {
  buildResourcePayload,
  getResourceFormSchema,
  toResourceFormValues,
} from '../lib/resource-form'
import type { ResourceFormValues } from '../types'
import { useResourcesAdmin } from './resources-provider'

/** 新建 / 编辑共用的侧抽屉：字段与服务端 payload 一一对应。 */
export function ResourceMutateDrawer() {
  const { t } = useTranslation()
  const { open, setOpen, currentRow, triggerRefresh } = useResourcesAdmin()
  const queryClient = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  // 正文是 Markdown 大段文本，编辑 / 预览切换放在抽屉里（不额外引编辑器依赖）
  const [contentMode, setContentMode] = useState<'write' | 'preview'>('write')

  const isUpdate = open === 'edit' && !!currentRow
  const isOpen = open === 'create' || open === 'edit'

  const form = useForm<ResourceFormValues>({
    resolver: zodResolver(getResourceFormSchema(t)),
    defaultValues: RESOURCE_FORM_DEFAULT_VALUES,
  })

  useEffect(() => {
    setContentMode('write')
    if (!isOpen) {
      form.reset(RESOURCE_FORM_DEFAULT_VALUES)
      return
    }
    if (isUpdate && currentRow) {
      form.reset(toResourceFormValues(currentRow))
      return
    }
    // 新建时把排序号排在最后，省得每次手动改
    form.reset({ ...RESOURCE_FORM_DEFAULT_VALUES })
  }, [isOpen, isUpdate, currentRow, form])

  const kind = form.watch('kind')

  const onSubmit = async (values: ResourceFormValues) => {
    setIsSubmitting(true)
    try {
      const payload = buildResourcePayload(
        values,
        isUpdate ? currentRow?.id : undefined
      )
      if (isUpdate) {
        await updateResource(payload)
      } else {
        await createResource(payload)
      }
      toast.success(t('Resource saved'))
      invalidatePublicResources(queryClient)
      setOpen(null)
      triggerRefresh()
    } catch (error) {
      handleServerError(error, t('Failed to save resource'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    void form.handleSubmit(onSubmit)(event)
  }

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) setOpen(null)
      }}
    >
      <SheetContent className={sideDrawerContentClassName('sm:max-w-2xl')}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>
            {isUpdate ? t('Edit resource') : t('New resource')}
          </SheetTitle>
          <SheetDescription>
            {t(
              'Resources published here show up in the public Resource Hub right away.'
            )}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            id='resource-form'
            onSubmit={handleSubmit}
            className={sideDrawerFormClassName()}
            aria-busy={isSubmitting}
          >
            <SideDrawerSection>
              <SideDrawerSectionHeader title={t('Basics')} />
              <div className='grid gap-4 sm:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='slug'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>{t('Slug')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder='mcp-fetch' />
                      </FormControl>
                      <FormDescription>
                        {t('Used in the URL: /resources/{{slug}}', {
                          slug: field.value || '…',
                        })}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>{t('Name')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder='Fetch' />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='kind'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>{t('Kind')}</FormLabel>
                      <Select
                        items={RESOURCE_KIND_OPTIONS.map((option) => ({
                          value: option.value,
                          label: t(option.labelKey),
                        }))}
                        value={field.value}
                        onValueChange={(value) =>
                          field.onChange(value as ResourceFormValues['kind'])
                        }
                      >
                        <FormControl>
                          <SelectTrigger className='w-full'>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            {RESOURCE_KIND_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {t(option.labelKey)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='vendor'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>{t('Vendor')}</FormLabel>
                      <Select
                        items={RESOURCE_VENDOR_OPTIONS.map((option) => ({
                          value: option.value,
                          label: t(option.labelKey),
                        }))}
                        value={field.value}
                        onValueChange={(value) =>
                          field.onChange(value as ResourceFormValues['vendor'])
                        }
                      >
                        <FormControl>
                          <SelectTrigger className='w-full'>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent alignItemWithTrigger={false}>
                          <SelectGroup>
                            {RESOURCE_VENDOR_OPTIONS.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {t(option.labelKey)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='icon_name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Icon')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder='Claude.Color' />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Icon name from @lobehub/icons; leave empty to show the first letter.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='sort_order'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Sort order')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type='number'
                          step={10}
                          min={0}
                          onChange={(event) =>
                            field.onChange(Number(event.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'Smaller numbers appear first inside the same kind.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='enabled'
                render={({ field }) => (
                  <FormItem className={sideDrawerSwitchItemClassName()}>
                    <div>
                      <FormLabel>{t('Published')}</FormLabel>
                      <FormDescription>
                        {t('Unpublished resources are hidden from the hub.')}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='tags'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Tags')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder='web, http, scraping' />
                    </FormControl>
                    <FormDescription>
                      {t('Comma separated; used by search and filters.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>

            <SideDrawerSection>
              <SideDrawerSectionHeader
                title={t('Chinese copy')}
                description={t('Shown when the interface language is Chinese.')}
              />
              <FormField
                control={form.control}
                name='summary_zh'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>{t('Summary')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'At least one of the Chinese or English summary is required'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='description_zh'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Description')}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='highlights_zh'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Highlights')}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormDescription>
                      {t('One per line, up to 12 items.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>

            <SideDrawerSection>
              <SideDrawerSectionHeader
                title={t('English copy')}
                description={t(
                  'Shown for every other interface language, and as the fallback.'
                )}
              />
              <FormField
                control={form.control}
                name='summary_en'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>{t('Summary')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='description_en'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Description')}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='highlights_en'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Highlights')}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <FormDescription>
                      {t('One per line, up to 12 items.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>

            <SideDrawerSection>
              <FormField
                control={form.control}
                name='content'
                render={({ field }) => (
                  // grid-cols-1 + min-w-0：预览里的宽表格 / 长代码行不允许把栅格撑开，
                  // 否则整行变宽、右上角的编写 / 预览切换会被推到右边去
                  <FormItem className='min-w-0 grid-cols-1'>
                    <div className='flex w-full min-w-0 flex-wrap items-center justify-between gap-2'>
                      <FormLabel>{t('Content')}</FormLabel>
                      <ToggleGroup
                        value={[contentMode]}
                        onValueChange={(values) => {
                          const next = values[0]
                          if (next === 'write' || next === 'preview') {
                            setContentMode(next)
                          }
                        }}
                        variant='outline'
                        size='sm'
                        aria-label={t('Content display mode')}
                      >
                        <ToggleGroupItem value='write'>
                          {t('Write')}
                        </ToggleGroupItem>
                        <ToggleGroupItem value='preview'>
                          {t('Preview')}
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                    {contentMode === 'preview' ? (
                      <div className='border-border/60 bg-card/50 min-h-72 w-full min-w-0 overflow-hidden rounded-md border px-4 py-3'>
                        {field.value.trim() ? (
                          <Markdown className='max-w-full'>
                            {field.value}
                          </Markdown>
                        ) : (
                          <p className='text-muted-foreground text-sm'>
                            {t('Nothing to preview yet.')}
                          </p>
                        )}
                      </div>
                    ) : (
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={14}
                          className='min-h-72 font-mono text-xs leading-relaxed'
                          placeholder={`## What this skill does\n\n- ...`}
                        />
                      </FormControl>
                    )}
                    <FormDescription>
                      {t(
                        'Markdown supported (headings, lists, tables, code blocks). Rendered as-is on the detail page — keep the essentials here and link the repository or download URL for the full package.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>

            {kind === 'mcp' ? (
              <SideDrawerSection>
                <SideDrawerSectionHeader
                  title={t('MCP launch config')}
                  description={t(
                    'The hub turns this into per-client snippets (Claude Code, Codex, Cursor, VS Code…).'
                  )}
                />
                <div className='grid gap-4 sm:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='mcp_name'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Server name')}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder='fetch' />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='mcp_command'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel required>{t('Command')}</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder='uvx' />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name='mcp_args'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Arguments')}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={3}
                          placeholder='mcp-server-fetch'
                        />
                      </FormControl>
                      <FormDescription>
                        {t('One argument per line, in order.')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='mcp_env'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Environment variables')}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={2}
                          placeholder='GITHUB_PERSONAL_ACCESS_TOKEN=ghp_...'
                        />
                      </FormControl>
                      <FormDescription>
                        {t(
                          'KEY=VALUE per line. Values are placeholders shown to visitors.'
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </SideDrawerSection>
            ) : (
              <SideDrawerSection>
                <SideDrawerSectionHeader
                  title={t('Install command')}
                  description={t('Shown as a copyable terminal snippet.')}
                />
                <FormField
                  control={form.control}
                  name='install_command'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Command')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder='npm install -g @scope/package'
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </SideDrawerSection>
            )}

            <SideDrawerSection>
              <SideDrawerSectionHeader title={t('Links')} />
              <FormField
                control={form.control}
                name='download_url'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Download URL')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder='https://' />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='repo_url'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Repository URL')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder='https://github.com/…' />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>
          </form>
        </Form>

        <SheetFooter className={sideDrawerFooterClassName()}>
          <Button
            type='button'
            variant='outline'
            onClick={() => setOpen(null)}
            disabled={isSubmitting}
          >
            {t('Cancel')}
          </Button>
          <Button type='submit' form='resource-form' disabled={isSubmitting}>
            {isSubmitting ? t('Saving...') : t('Save')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
