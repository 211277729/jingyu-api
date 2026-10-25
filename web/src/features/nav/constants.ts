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
/**
 * Static directory data for the AI navigation page.
 *
 * Two layers: `CURATED_SITES` is hand-picked and always renders first, while
 * `DIRECTORY_SITES` (generated, see `directory.ts`) fills the rest. Both are
 * keyed by category id and merged in category order, so a curated entry always
 * wins over a generated one for the same host.
 *
 * Categories are single level by design. `iconName` is a `@lobehub/icons` name
 * and is optional: cards without one fall back to an initial badge.
 */
import { DIRECTORY_SITES } from './directory'
import type { NavCategory, NavSite } from './types'

/** Hand-picked entries; these render before the generated directory. */
const CURATED_SITES: Record<string, NavSite[]> = {
  chat: [
    { name: 'ChatGPT', url: 'https://chatgpt.com', iconName: 'OpenAI' },
    { name: 'Claude', url: 'https://claude.ai', iconName: 'Claude.Color' },
    {
      name: 'Gemini',
      url: 'https://gemini.google.com',
      iconName: 'Gemini.Color',
    },
    {
      name: 'DeepSeek',
      url: 'https://chat.deepseek.com',
      iconName: 'DeepSeek.Color',
    },
    { name: 'Kimi', url: 'https://kimi.moonshot.cn', iconName: 'Kimi.Color' },
    { name: '豆包', url: 'https://www.doubao.com', iconName: 'Doubao.Color' },
    {
      name: '通义千问',
      url: 'https://tongyi.aliyun.com',
      iconName: 'Qwen.Color',
    },
    {
      name: '智谱清言',
      url: 'https://chatglm.cn',
      iconName: 'Zhipu.Color',
    },
  ],
  coding: [
    {
      name: 'GitHub Copilot',
      url: 'https://github.com/features/copilot',
      iconName: 'GithubCopilot',
    },
    { name: 'Cursor', url: 'https://cursor.com', iconName: 'Cursor' },
    {
      name: 'Claude Code',
      url: 'https://www.anthropic.com/claude-code',
      iconName: 'ClaudeCode.Color',
    },
    {
      name: 'Codex',
      url: 'https://openai.com/codex',
      iconName: 'Codex.Color',
    },
    { name: 'Cline', url: 'https://cline.bot', iconName: 'Cline' },
    { name: 'v0', url: 'https://v0.app', iconName: 'V0' },
    {
      name: 'Lovable',
      url: 'https://lovable.dev',
      iconName: 'Lovable.Color',
    },
    { name: 'Replit', url: 'https://replit.com', iconName: 'Replit.Color' },
  ],
  image: [
    {
      name: 'Midjourney',
      url: 'https://www.midjourney.com',
      iconName: 'Midjourney',
    },
    {
      name: 'Civitai',
      url: 'https://civitai.com',
      iconName: 'Civitai.Color',
    },
    { name: 'Flux', url: 'https://blackforestlabs.ai', iconName: 'Flux' },
    { name: 'Krea', url: 'https://www.krea.ai', iconName: 'Krea' },
    { name: 'Recraft', url: 'https://www.recraft.ai', iconName: 'Recraft' },
    { name: 'Ideogram', url: 'https://ideogram.ai' },
  ],
  video: [
    { name: 'Sora', url: 'https://sora.chatgpt.com', iconName: 'Sora.Color' },
    { name: 'Runway', url: 'https://runwayml.com', iconName: 'Runway' },
    { name: 'Pika', url: 'https://pika.art', iconName: 'Pika' },
    {
      name: 'Luma Dream Machine',
      url: 'https://lumalabs.ai/dream-machine',
      iconName: 'Luma.Color',
    },
    { name: '可灵', url: 'https://klingai.com', iconName: 'Kling.Color' },
    {
      name: '海螺 AI',
      url: 'https://hailuoai.com',
      iconName: 'Hailuo.Color',
    },
    { name: 'Vidu', url: 'https://www.vidu.cn', iconName: 'Vidu.Color' },
  ],
  audio: [
    { name: 'Suno', url: 'https://suno.com', iconName: 'Suno' },
    { name: 'Udio', url: 'https://www.udio.com', iconName: 'Udio.Color' },
    {
      name: 'ElevenLabs',
      url: 'https://elevenlabs.io',
      iconName: 'ElevenLabs',
    },
    { name: 'Mureka', url: 'https://www.mureka.ai' },
  ],
  research: [
    {
      name: 'Perplexity',
      url: 'https://www.perplexity.ai',
      iconName: 'Perplexity.Color',
    },
    {
      name: 'Semantic Scholar',
      url: 'https://www.semanticscholar.org',
    },
    { name: 'arXiv', url: 'https://arxiv.org' },
    { name: 'Elicit', url: 'https://elicit.com' },
    { name: 'Consensus', url: 'https://consensus.app' },
    { name: '秘塔 AI 搜索', url: 'https://metaso.cn' },
  ],
  infra: [
    {
      name: 'Hugging Face',
      url: 'https://huggingface.co',
      iconName: 'HuggingFace.Color',
    },
    {
      name: 'OpenRouter',
      url: 'https://openrouter.ai',
      iconName: 'OpenRouter.Color',
    },
    { name: 'Ollama', url: 'https://ollama.com', iconName: 'Ollama' },
    {
      name: '魔搭社区',
      url: 'https://modelscope.cn',
      iconName: 'ModelScope.Color',
    },
    {
      name: 'Replicate',
      url: 'https://replicate.com',
      iconName: 'Replicate',
    },
    { name: 'Groq', url: 'https://groq.com', iconName: 'Groq' },
    {
      name: 'Together AI',
      url: 'https://www.together.ai',
      iconName: 'Together.Color',
    },
  ],
  agents: [
    { name: '扣子Coze', url: 'https://www.coze.cn', iconName: 'Coze' },
    { name: 'Dify', url: 'https://dify.ai', iconName: 'Dify.Color' },
    { name: 'n8n', url: 'https://n8n.io', iconName: 'N8n.Color' },
    {
      name: 'LangChain',
      url: 'https://www.langchain.com',
      iconName: 'LangChain.Color',
    },
    {
      name: 'LangGraph',
      url: 'https://www.langchain.com/langgraph',
      iconName: 'LangGraph.Color',
    },
    { name: 'Zapier', url: 'https://zapier.com', iconName: 'Zapier.Color' },
  ],
  learn: [
    { name: 'DeepLearning.AI', url: 'https://www.deeplearning.ai' },
    { name: 'fast.ai', url: 'https://www.fast.ai' },
    { name: 'Kaggle', url: 'https://www.kaggle.com' },
    { name: '机器之心', url: 'https://www.jiqizhixin.com' },
    { name: '量子位', url: 'https://www.qbitai.com' },
    { name: 'GitHub', url: 'https://github.com', iconName: 'Github' },
  ],
}

/** Rendering order; ids line up with the keys used by both data layers. */
const CATEGORY_ORDER: { id: string; labelKey: string }[] = [
  { id: 'chat', labelKey: 'Chat Assistants' },
  { id: 'writing', labelKey: 'AI Writing' },
  { id: 'office', labelKey: 'Office & Productivity' },
  { id: 'coding', labelKey: 'Coding' },
  { id: 'image', labelKey: 'Image Generation' },
  { id: 'design', labelKey: 'Design' },
  { id: 'video', labelKey: 'Video Generation' },
  { id: 'audio', labelKey: 'Audio & Music' },
  { id: 'research', labelKey: 'Search & Research' },
  { id: 'infra', labelKey: 'Models & Infrastructure' },
  { id: 'agents', labelKey: 'Agents & Automation' },
  { id: 'translation', labelKey: 'Translation' },
  { id: 'prompt', labelKey: 'Prompt Engineering' },
  { id: 'detection', labelKey: 'Content Detection' },
  { id: 'browser', labelKey: 'AI Browsers' },
  { id: 'learn', labelKey: 'Learning & Community' },
]

/** Registered host used to dedupe generated entries against curated ones. */
function hostKey(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

function mergeSites(categoryId: string): NavSite[] {
  const curated = CURATED_SITES[categoryId] ?? []
  const takenHosts = new Set(curated.map((site) => hostKey(site.url)))
  const takenNames = new Set(
    curated.map((site) => site.name.trim().toLowerCase())
  )
  const generated = DIRECTORY_SITES[categoryId] ?? []
  const merged = [...curated]

  for (const site of generated) {
    const host = hostKey(site.url)
    const name = site.name.trim().toLowerCase()
    if (takenHosts.has(host) || takenNames.has(name)) continue
    takenHosts.add(host)
    takenNames.add(name)
    merged.push(site)
  }

  return merged
}

export const NAV_CATEGORIES: NavCategory[] = CATEGORY_ORDER.map((category) => ({
  id: category.id,
  labelKey: category.labelKey,
  sites: mergeSites(category.id),
}))

export const NAV_SITE_COUNT = NAV_CATEGORIES.reduce(
  (total, category) => total + category.sites.length,
  0
)
