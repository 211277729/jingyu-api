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
import type { ResourceItem } from './types'

/**
 * 资源广场的静态精选数据（第一阶段纯前端）。
 *
 * 约定：
 * - 只收录确定存在的官方仓库 / 官网地址，宁缺毋错；
 * - installCommand 必须可直接执行，无法给准时宁可省略；
 * - 后续接入后台配置后，此文件降级为默认数据源。
 */
export const RESOURCES: ResourceItem[] = [
  // ---------------------------------------------------------------- MCP 服务器
  {
    slug: 'mcp-fetch',
    name: 'Fetch',
    kind: 'mcp',
    tags: ['web', 'http', 'scraping'],
    vendor: 'Official',
    summary: {
      zh: '抓取网页并转为 Markdown，让 Agent 能直接阅读线上文档与文章。',
      en: 'Fetches web pages and converts them to Markdown so agents can read online docs and articles.',
    },
    description: {
      zh: '官方网页抓取服务器。Agent 拿到 URL 后即可拉取页面内容，自动用 HTML 转写的 Markdown 呈现，省去手写解析的功夫；可按需禁止特定域名。',
      en: 'The official web fetching server. Given a URL, the agent pulls the page and reads it as converted Markdown, with optional domain blocklists.',
    },
    highlights: {
      zh: ['官方维护，开箱即用', 'HTML 自动转 Markdown', '支持按域名拦截'],
      en: [
        'Officially maintained, works out of the box',
        'Automatic HTML to Markdown conversion',
        'Optional per-domain blocking',
      ],
    },
    installCommand: 'claude mcp add fetch -- uvx mcp-server-fetch',
    repoUrl: 'https://github.com/modelcontextprotocol/servers',
  },
  {
    slug: 'mcp-filesystem',
    name: 'Filesystem',
    kind: 'mcp',
    tags: ['files', 'local'],
    vendor: 'Official',
    summary: {
      zh: '在指定目录内安全地读写文件，是最常用的本地能力 MCP。',
      en: 'Reads and writes files inside an allow-listed directory tree.',
    },
    description: {
      zh: '官方文件系统服务器。把某个目录授权给它后，Agent 可以创建、读取、移动和搜索文件，越出授权目录的访问会被拒绝，适合给不具备本地执行环境的客户端补上文件能力。',
      en: 'The official filesystem server. Authorize a directory and the agent can create, read, move and search files; access outside the allow-list is refused.',
    },
    highlights: {
      zh: [
        '目录白名单，越界即拒',
        '读写移动搜索全套能力',
        '官方 servers 合集成员',
      ],
      en: [
        'Directory allow-list enforcement',
        'Create, read, move and search files',
        'Part of the official servers collection',
      ],
    },
    installCommand:
      'claude mcp add filesystem -- npx -y @modelcontextprotocol/server-filesystem ~/Documents',
    repoUrl: 'https://github.com/modelcontextprotocol/servers',
  },
  {
    slug: 'mcp-memory',
    name: 'Memory',
    kind: 'mcp',
    tags: ['knowledge-graph', 'persistence'],
    vendor: 'Official',
    summary: {
      zh: '基于知识图谱的长期记忆，让 Agent 记住你的偏好与上下文。',
      en: 'Knowledge-graph backed long-term memory for your agents.',
    },
    description: {
      zh: '官方记忆服务器。把实体和关系存成一张知识图谱，跨会话保留用户偏好、项目结构等上下文；数据落盘在本地 JSON 文件，可随时备份迁移。',
      en: 'The official memory server. Stores entities and relations as a knowledge graph that persists across sessions, backed by a local JSON file you can back up freely.',
    },
    highlights: {
      zh: ['实体 + 关系的知识图谱', '跨会话长期保留', '本地 JSON 存储，易备份'],
      en: [
        'Entity and relation knowledge graph',
        'Persists across sessions',
        'Local JSON storage, easy to back up',
      ],
    },
    installCommand:
      'claude mcp add memory -- npx -y @modelcontextprotocol/server-memory',
    repoUrl: 'https://github.com/modelcontextprotocol/servers',
  },
  {
    slug: 'mcp-git',
    name: 'Git',
    kind: 'mcp',
    tags: ['vcs', 'code'],
    vendor: 'Official',
    summary: {
      zh: '读写 Git 仓库：查看历史、暂存提交、分支管理一条龙。',
      en: 'Operates Git repositories: history, staging, commits and branches.',
    },
    description: {
      zh: '官方 Git 服务器。Agent 可以查询提交历史与 diff、暂存文件、创建提交和分支，把"帮我看看这段代码什么时候改的"这类诉求直接交给模型执行。',
      en: 'The official Git server. The agent can inspect history and diffs, stage files, and create commits and branches — no shell wrangling required.',
    },
    highlights: {
      zh: [
        '历史 / diff / 提交全覆盖',
        '无需手敲 git 命令',
        'Python 实现，uvx 直接跑',
      ],
      en: [
        'History, diff and commits covered',
        'No manual git commands',
        'Python implementation via uvx',
      ],
    },
    installCommand: 'claude mcp add git -- uvx mcp-server-git',
    repoUrl: 'https://github.com/modelcontextprotocol/servers',
  },
  {
    slug: 'mcp-postgres',
    name: 'Postgres',
    kind: 'mcp',
    tags: ['database', 'sql', 'read-only'],
    vendor: 'Official',
    summary: {
      zh: '只读巡检 PostgreSQL：列结构、表统计、慢查询分析。',
      en: 'Read-only PostgreSQL inspection: schemas, stats and query analysis.',
    },
    description: {
      zh: '官方数据库巡检服务器，默认只读。Agent 可以浏览 schema、查看表统计与执行计划，帮你定位慢查询；没有写权限，连接生产库也更放心。',
      en: 'The official read-only database server. Browse schemas, table stats and explain plans to debug slow queries — no write access, safer against production.',
    },
    highlights: {
      zh: ['默认只读，生产可用', 'schema / 统计 / 执行计划', '连接串即配置'],
      en: [
        'Read-only by default, production friendly',
        'Schemas, stats and explain plans',
        'Configured by connection string',
      ],
    },
    installCommand:
      'claude mcp add postgres -- npx -y @modelcontextprotocol/server-postgres postgresql://localhost:5432/mydb',
    repoUrl: 'https://github.com/modelcontextprotocol/servers',
  },
  {
    slug: 'mcp-playwright',
    name: 'Playwright MCP',
    kind: 'mcp',
    tags: ['browser', 'automation', 'testing'],
    vendor: 'Official',
    summary: {
      zh: '微软官方浏览器自动化：让 Agent 操作真实浏览器完成验证与调试。',
      en: 'Microsoft official browser automation: let agents drive a real browser.',
    },
    description: {
      zh: '由微软 Playwright 团队维护的浏览器服务器。Agent 能打开页面、点击输入、截图并读取可访问性快照，适合 E2E 验证、网页调试和需要登录态的操作。',
      en: 'Maintained by the Microsoft Playwright team. Agents open pages, click, type, screenshot and read accessibility snapshots — great for E2E checks and authenticated flows.',
    },
    highlights: {
      zh: ['微软官方出品', '结构化快照而非盲截图', '可复用登录态 profile'],
      en: [
        'Officially maintained by Microsoft',
        'Structured snapshots instead of blind screenshots',
        'Reuses browser profiles for login state',
      ],
    },
    installCommand:
      'claude mcp add playwright -- npx -y @playwright/mcp@latest',
    repoUrl: 'https://github.com/microsoft/playwright-mcp',
  },
  {
    slug: 'mcp-github',
    name: 'GitHub MCP',
    kind: 'mcp',
    tags: ['github', 'issues', 'ci'],
    vendor: 'Official',
    summary: {
      zh: 'GitHub 官方服务器：仓库、Issue、PR、Actions 全平台操作。',
      en: 'GitHub official server: repos, issues, pull requests and Actions.',
    },
    description: {
      zh: 'GitHub 官方维护的 MCP 服务器，覆盖仓库管理、Issue 与 PR 流转、代码检索和 Actions 触发。配上个人访问令牌，Agent 就能替你盯仓库、发评论、开 PR。',
      en: 'The official GitHub MCP server covering repo management, issue and PR flows, code search and Actions. With a personal access token, agents can watch repos, comment and open PRs for you.',
    },
    highlights: {
      zh: ['GitHub 官方维护', 'Issue / PR / Actions 全覆盖', 'Docker 一行启动'],
      en: [
        'Maintained by GitHub',
        'Issues, PRs and Actions covered',
        'One-line Docker startup',
      ],
    },
    installCommand:
      'claude mcp add github -- docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server',
    repoUrl: 'https://github.com/github/github-mcp-server',
  },
  {
    slug: 'mcp-context7',
    name: 'Context7',
    kind: 'mcp',
    tags: ['docs', 'libraries'],
    vendor: 'Community',
    summary: {
      zh: '实时拉取各类库的最新文档，终结模型"API 记忆过期"的问题。',
      en: 'Pulls up-to-date library docs on demand to beat stale model knowledge.',
    },
    description: {
      zh: 'Upstash 出品的文档查询服务器。写代码前先查一次最新文档并注入上下文，模型给出的 API 用法就是当前版本的行为，显著减少幻觉与旧版写法。',
      en: 'A docs server by Upstash. Query the latest docs before writing code and the model answers with current-version behavior, cutting hallucinated or outdated APIs.',
    },
    highlights: {
      zh: ['文档实时更新', '按库精确注入上下文', '一行 npx 接入'],
      en: [
        'Docs refreshed in real time',
        'Per-library context injection',
        'One-line npx setup',
      ],
    },
    installCommand: 'claude mcp add context7 -- npx -y @upstash/context7-mcp',
    repoUrl: 'https://github.com/upstash/context7',
  },
  {
    slug: 'mcp-sequential-thinking',
    name: 'Sequential Thinking',
    kind: 'mcp',
    tags: ['reasoning', 'planning'],
    vendor: 'Official',
    summary: {
      zh: '给 Agent 一个结构化思考画板：分步推理、修订与分支探索。',
      en: 'A structured thinking canvas: stepwise reasoning, revisions and branches.',
    },
    description: {
      zh: '官方推理服务器。把复杂问题拆成可控的思考步骤，支持中途修订与分支假设，让模型在长链路任务里少跑偏，规划类场景提升明显。',
      en: 'The official reasoning server. Breaks complex problems into reviewable steps with revisions and branch hypotheses, keeping long task chains on track.',
    },
    highlights: {
      zh: ['分步推理可审计', '支持修订与分支假设', '零依赖纯思考工具'],
      en: [
        'Auditable stepwise reasoning',
        'Revisions and branch hypotheses',
        'Zero-dependency thinking tool',
      ],
    },
    installCommand:
      'claude mcp add sequential-thinking -- npx -y @modelcontextprotocol/server-sequential-thinking',
    repoUrl: 'https://github.com/modelcontextprotocol/servers',
  },
  {
    slug: 'mcp-firecrawl',
    name: 'Firecrawl MCP',
    kind: 'mcp',
    tags: ['scraping', 'markdown', 'crawler'],
    vendor: 'Community',
    summary: {
      zh: '整站爬取转 Markdown，比单页抓取更进一步的数据采集方案。',
      en: 'Full-site crawling to Markdown, a step beyond single-page fetching.',
    },
    description: {
      zh: 'Firecrawl 官方 MCP 服务器。支持单页抓取、整站爬取、站内搜索与结构化提取，自动处理 JS 渲染页面并输出干净的 Markdown，适合做知识库与语料采集。',
      en: 'The official Firecrawl MCP server. Single-page fetch, full-site crawl, search and structured extraction with JS rendering handled — ideal for knowledge bases and corpora.',
    },
    highlights: {
      zh: ['整站爬取 + 结构化提取', '自动处理 JS 渲染', '免费额度即可上手'],
      en: [
        'Site-wide crawl and structured extraction',
        'JavaScript rendering handled',
        'Free tier to get started',
      ],
    },
    installCommand: 'claude mcp add firecrawl -- npx -y firecrawl-mcp',
    repoUrl: 'https://github.com/firecrawl/firecrawl-mcp-server',
  },

  // ---------------------------------------------------------------- Agent 技能包
  {
    slug: 'skill-docx',
    name: 'docx',
    kind: 'skill',
    tags: ['word', 'documents', 'office'],
    vendor: 'Official',
    summary: {
      zh: '让 Claude 稳定创建和编辑 Word 文档，官方文档技能之一。',
      en: 'Lets Claude create and edit Word documents reliably.',
    },
    description: {
      zh: 'Anthropic 官方文档技能。处理 Word 的创建、读取、修改与格式保留，比让模型"凭感觉"写 Office 文件稳定得多，报告生成场景必备。放到 ~/.claude/skills/ 目录即可被识别。',
      en: 'An official Anthropic document skill for creating, reading and editing Word files with formatting preserved. Drop it into ~/.claude/skills/ and it is picked up automatically.',
    },
    highlights: {
      zh: [
        '官方出品，格式保留可靠',
        '创建 / 编辑 / 读取全覆盖',
        '下载即用，无需安装依赖',
      ],
      en: [
        'Official skill with reliable formatting',
        'Create, edit and read covered',
        'Download and use, no extra deps',
      ],
    },
    downloadUrl: 'https://github.com/anthropics/skills',
    repoUrl: 'https://github.com/anthropics/skills',
  },
  {
    slug: 'skill-pptx',
    name: 'pptx',
    kind: 'skill',
    tags: ['slides', 'office'],
    vendor: 'Official',
    summary: {
      zh: '官方 PPT 技能：一句话生成结构完整、可二次编辑的幻灯片。',
      en: 'Official slides skill: generate editable decks from a single prompt.',
    },
    description: {
      zh: 'Anthropic 官方演示文稿技能。按大纲生成带母版、图表与排版的 PPTX，产物在 PowerPoint / Keynote 里可继续编辑，周报、提案类输出效率翻倍。',
      en: 'The official presentation skill. Generates PPTX with layouts, charts and typography that stay editable in PowerPoint or Keynote — great for weekly reports and proposals.',
    },
    highlights: {
      zh: ['产物可二次编辑', '支持图表与排版', '官方持续维护'],
      en: [
        'Fully editable output',
        'Charts and layouts supported',
        'Maintained by Anthropic',
      ],
    },
    downloadUrl: 'https://github.com/anthropics/skills',
    repoUrl: 'https://github.com/anthropics/skills',
  },
  {
    slug: 'skill-xlsx',
    name: 'xlsx',
    kind: 'skill',
    tags: ['excel', 'spreadsheet', 'office'],
    vendor: 'Official',
    summary: {
      zh: '官方 Excel 技能：读写表格、保留公式与多表结构。',
      en: 'Official Excel skill: read and write workbooks with formulas intact.',
    },
    description: {
      zh: 'Anthropic 官方表格技能。能解析现有工作簿、保留公式与跨表引用，也能按数据生成新的报表，对账、汇总类任务直接交给 Agent。',
      en: 'The official spreadsheet skill. Parses existing workbooks with formulas and cross-sheet references intact, or builds new reports from raw data.',
    },
    highlights: {
      zh: ['公式与跨表引用可保留', '既有表解析 + 新表生成', '对账汇总场景利器'],
      en: [
        'Formulas and references preserved',
        'Parse existing or generate new workbooks',
        'Great for reconciliation tasks',
      ],
    },
    downloadUrl: 'https://github.com/anthropics/skills',
    repoUrl: 'https://github.com/anthropics/skills',
  },
  {
    slug: 'skill-pdf',
    name: 'pdf',
    kind: 'skill',
    tags: ['pdf', 'documents'],
    vendor: 'Official',
    summary: {
      zh: '官方 PDF 技能：填表、抽取、拆分合并与格式转换。',
      en: 'Official PDF skill: forms, extraction, splitting and merging.',
    },
    description: {
      zh: 'Anthropic 官方 PDF 处理技能。覆盖表单填写、文本与表格抽取、页面拆分合并，是文档自动化流水线里最常用的一个。',
      en: 'The official PDF processing skill. Covers form filling, text and table extraction, and page splitting or merging — a staple of document automation.',
    },
    highlights: {
      zh: ['表单填写 + 内容抽取', '拆分合并一步到位', '与其他文档技能组合使用'],
      en: [
        'Form filling and extraction',
        'Split and merge in one step',
        'Composes with other document skills',
      ],
    },
    downloadUrl: 'https://github.com/anthropics/skills',
    repoUrl: 'https://github.com/anthropics/skills',
  },
  {
    slug: 'skill-frontend-design',
    name: 'frontend-design',
    kind: 'skill',
    tags: ['ui', 'design', 'frontend'],
    vendor: 'Official',
    summary: {
      zh: '官方前端审美技能：让生成的页面摆脱"AI 味"模板脸。',
      en: 'Official frontend taste skill: escape generic AI-generated UIs.',
    },
    description: {
      zh: 'Anthropic 官方前端设计技能。注入设计原则与审美约束，让 Agent 产出的界面在字体、间距、色彩上更接近真人设计稿，做落地页和活动页效果拔群。',
      en: 'The official frontend design skill. Injects design principles so agent-built UIs look authored rather than templated — a big win for landing and campaign pages.',
    },
    highlights: {
      zh: ['显著提升 UI 质感', '设计原则系统化注入', '前端开发者日常可用'],
      en: [
        'Noticeably better UI quality',
        'Systematic design principles',
        'Day-to-day useful for frontend devs',
      ],
    },
    downloadUrl: 'https://github.com/anthropics/skills',
    repoUrl: 'https://github.com/anthropics/skills',
  },
  {
    slug: 'skill-mcp-builder',
    name: 'mcp-builder',
    kind: 'skill',
    tags: ['mcp', 'development'],
    vendor: 'Official',
    summary: {
      zh: '官方 MCP 开发技能：帮你写出符合规范的 MCP 服务器。',
      en: 'Official skill for building spec-compliant MCP servers.',
    },
    description: {
      zh: 'Anthropic 官方 MCP 构建技能。从协议规范、项目脚手架到最佳实践一路指导，适合想把自有工具封装成 MCP 的开发者，配 Context7 查文档使用更佳。',
      en: 'The official MCP building skill. Guides you from protocol specs to scaffolding and best practices — ideal for wrapping your own tools as MCP servers.',
    },
    highlights: {
      zh: ['协议规范内置', '脚手架 + 最佳实践', '自建 MCP 的最快路径'],
      en: [
        'Protocol specs built in',
        'Scaffolding and best practices',
        'Fastest path to your own MCP server',
      ],
    },
    downloadUrl: 'https://github.com/anthropics/skills',
    repoUrl: 'https://github.com/anthropics/skills',
  },
  {
    slug: 'skill-canvas-design',
    name: 'canvas-design',
    kind: 'skill',
    tags: ['design', 'poster', 'graphic'],
    vendor: 'Official',
    summary: {
      zh: '官方平面设计技能：海报、封面、社交媒体图一键生成。',
      en: 'Official graphic design skill for posters, covers and social assets.',
    },
    description: {
      zh: 'Anthropic 官方设计技能。按主题、尺寸和风格要求产出视觉成品，海报与封面类任务不再需要排队等设计师，社媒配图批量产出尤其省事。',
      en: 'The official design skill. Produces visual assets from a brief — theme, size and style — ideal for batch-generating posters, covers and social media graphics.',
    },
    highlights: {
      zh: ['海报 / 封面 / 配图通吃', '按风格与尺寸定制', '批量产出效率高'],
      en: [
        'Posters, covers and social assets',
        'Customized by style and size',
        'Efficient batch production',
      ],
    },
    downloadUrl: 'https://github.com/anthropics/skills',
    repoUrl: 'https://github.com/anthropics/skills',
  },
  {
    slug: 'skill-webapp-testing',
    name: 'webapp-testing',
    kind: 'skill',
    tags: ['testing', 'qa'],
    vendor: 'Official',
    summary: {
      zh: '官方 Web 测试技能：驱动浏览器验证你的 Web 应用行为。',
      en: 'Official web testing skill: drive a browser to verify your app.',
    },
    description: {
      zh: 'Anthropic 官方测试技能。组合 Playwright 驱动浏览器完成交互验证与截图断言，改完前端让 Agent 自己点一遍，回归测试不再靠肉眼。',
      en: 'The official testing skill. Combines Playwright with interaction verification and screenshot assertions — let the agent click through your app after every change.',
    },
    highlights: {
      zh: ['真实浏览器交互验证', '截图断言可复核', '回归测试自动化'],
      en: [
        'Real browser interaction checks',
        'Reviewable screenshot assertions',
        'Automated regression testing',
      ],
    },
    downloadUrl: 'https://github.com/anthropics/skills',
    repoUrl: 'https://github.com/anthropics/skills',
  },

  // ---------------------------------------------------------------- Agent 工具
  {
    slug: 'tool-claude-code',
    name: 'Claude Code',
    kind: 'agent-tool',
    iconName: 'Claude.Color',
    tags: ['terminal', 'agent', 'coding'],
    vendor: 'Official',
    summary: {
      zh: 'Anthropic 官方终端编程 Agent，把任务直接交给命令行里的模型。',
      en: "Anthropic's official terminal coding agent.",
    },
    description: {
      zh: '在终端里运行的多步编程 Agent：读仓库、改代码、跑测试、提 PR 一气呵成，支持 MCP 扩展。配合本站网关，把 ANTHROPIC_BASE_URL 指向站点地址即可使用。',
      en: 'A multi-step coding agent in your terminal: reads repos, edits code, runs tests and opens PRs. Point ANTHROPIC_BASE_URL at this gateway and it just works.',
    },
    highlights: {
      zh: [
        '终端原生的多步执行',
        'MCP 生态完全兼容',
        '网关接入只需两个环境变量',
      ],
      en: [
        'Native multi-step terminal agent',
        'Full MCP ecosystem compatibility',
        'Two env vars to connect the gateway',
      ],
    },
    installCommand: 'npm install -g @anthropic-ai/claude-code',
    downloadUrl: 'https://www.anthropic.com/claude-code',
    repoUrl: 'https://github.com/anthropics/claude-code',
  },
  {
    slug: 'tool-codex-cli',
    name: 'Codex CLI',
    kind: 'agent-tool',
    iconName: 'OpenAI',
    tags: ['terminal', 'agent', 'coding'],
    vendor: 'Official',
    summary: {
      zh: 'OpenAI 官方开源终端 Agent，轻量快速的命令行编码助手。',
      en: "OpenAI's open-source terminal coding agent.",
    },
    description: {
      zh: 'OpenAI 开源的命令行编码 Agent，支持沙箱执行与多模态输入。配置 OpenAI 兼容端点后同样可以走本站网关调度。',
      en: 'An open-source command-line coding agent from OpenAI with sandboxed execution. Works with OpenAI-compatible endpoints, including this gateway.',
    },
    highlights: {
      zh: ['开源，可审计', '沙箱执行更安全', 'OpenAI 兼容端点即插即用'],
      en: [
        'Open source and auditable',
        'Sandboxed execution',
        'Works with OpenAI-compatible endpoints',
      ],
    },
    installCommand: 'npm install -g @openai/codex',
    repoUrl: 'https://github.com/openai/codex',
  },
  {
    slug: 'tool-cherry-studio',
    name: 'Cherry Studio',
    kind: 'agent-tool',
    iconName: 'CherryStudio',
    tags: ['desktop', 'chat', 'mcp'],
    vendor: 'Community',
    summary: {
      zh: '多模型桌面客户端：对话、知识库、MCP 一站式，图形界面首选。',
      en: 'A multi-model desktop client with chat, knowledge bases and MCP.',
    },
    description: {
      zh: '功能完整的桌面 AI 客户端，支持多供应商、知识库、翻译与 MCP 工具调用。在设置里添加自定义供应商，填入本站网关地址与密钥即可开聊。',
      en: 'A full-featured desktop AI client with multi-provider chat, knowledge bases, translation and MCP tools. Add a custom provider with this gateway and start chatting.',
    },
    highlights: {
      zh: ['Win / macOS / Linux 全平台', '知识库 + MCP 支持', '图形界面零门槛'],
      en: [
        'Windows, macOS and Linux',
        'Knowledge base and MCP support',
        'No-terminal GUI experience',
      ],
    },
    downloadUrl: 'https://www.cherry-ai.com',
    repoUrl: 'https://github.com/CherryHQ/cherry-studio',
  },
  {
    slug: 'tool-cline',
    name: 'Cline',
    kind: 'agent-tool',
    iconName: 'Cline',
    tags: ['vscode', 'coding', 'agent'],
    vendor: 'Community',
    summary: {
      zh: 'VS Code 里的编程 Agent 扩展，计划确认后再动手，过程透明。',
      en: 'A VS Code coding agent extension with plan-first transparency.',
    },
    description: {
      zh: '开源的 VS Code 编程扩展。先出计划、经你确认再改文件、跑命令，全程在编辑器内可见。配置 OpenAI 兼容供应商指向本站网关即可使用全部模型。',
      en: 'An open-source VS Code extension. It proposes a plan first, then edits files and runs commands after your approval — all visible inside the editor. Point it at this gateway.',
    },
    highlights: {
      zh: [
        '计划先行，改动可控',
        '编辑器内全程可视化',
        '支持 OpenAI 兼容供应商',
      ],
      en: [
        'Plan-first, approved changes',
        'Fully visible inside VS Code',
        'OpenAI-compatible provider support',
      ],
    },
    downloadUrl: 'https://cline.bot',
    repoUrl: 'https://github.com/cline/cline',
  },
  {
    slug: 'tool-lobechat',
    name: 'LobeChat',
    kind: 'agent-tool',
    iconName: 'LobeChat',
    tags: ['chat', 'webui', 'plugins'],
    vendor: 'Community',
    summary: {
      zh: '高颜值开源对话工作台：插件市场、知识库、多模型聚合。',
      en: 'A polished open-source chat workbench with plugins and knowledge bases.',
    },
    description: {
      zh: 'LobeHub 出品的开源对话应用，插件生态丰富，支持知识库与多模态。自部署或使用官方版后，在服务商设置里接入本站网关即可。',
      en: 'An open-source chat app by LobeHub with a rich plugin ecosystem, knowledge bases and multimodal support. Connect this gateway in the provider settings.',
    },
    highlights: {
      zh: ['插件与助手市场', '自部署友好', '多模态与语音支持'],
      en: [
        'Plugin and assistant marketplace',
        'Self-hosting friendly',
        'Multimodal and voice support',
      ],
    },
    downloadUrl: 'https://lobehub.com',
    repoUrl: 'https://github.com/lobehub/lobe-chat',
  },
  {
    slug: 'tool-open-webui',
    name: 'Open WebUI',
    kind: 'agent-tool',
    tags: ['chat', 'webui', 'self-hosted'],
    vendor: 'Community',
    summary: {
      zh: '最流行的自托管 Web UI：一行 Docker 起服务，团队共享首选。',
      en: 'The most popular self-hosted Web UI, up in one Docker line.',
    },
    description: {
      zh: '自托管 AI 界面的事实标准，支持多用户、RAG、函数工具与 MCP。Docker 一行启动后，把 OpenAI API 地址配置为本站网关，团队即可共享使用。',
      en: 'The de facto standard self-hosted AI interface with multi-user support, RAG, functions and MCP. Start it with one Docker line and point it at this gateway.',
    },
    highlights: {
      zh: ['一行 Docker 部署', '多用户与权限管理', 'RAG 与函数工具内置'],
      en: [
        'One-line Docker deployment',
        'Multi-user with permissions',
        'RAG and function tools built in',
      ],
    },
    downloadUrl: 'https://openwebui.com',
    repoUrl: 'https://github.com/open-webui/open-webui',
  },
]
