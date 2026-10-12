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
 * Relay routes this gateway exposes to API clients.
 *
 * The paths mirror `router/relay-router.go`; update both together.
 */
export type EndpointDefinition = {
  method: string
  path: string
  /** i18n key for the wire protocol name. */
  protocolKey: string
  auth: string
  /** i18n key for what the route is normally used for. */
  purposeKey: string
}

export const DOCS_ENDPOINTS: EndpointDefinition[] = [
  {
    method: 'GET',
    path: '/v1/models',
    protocolKey: 'OpenAI / Anthropic',
    auth: 'Authorization: Bearer sk-…',
    purposeKey: 'Model list',
  },
  {
    method: 'POST',
    path: '/v1/chat/completions',
    protocolKey: 'OpenAI Chat Completions',
    auth: 'Authorization: Bearer sk-…',
    purposeKey: 'Chat, tools and streaming',
  },
  {
    method: 'POST',
    path: '/v1/responses',
    protocolKey: 'OpenAI Responses',
    auth: 'Authorization: Bearer sk-…',
    purposeKey: 'Used by Codex',
  },
  {
    method: 'POST',
    path: '/v1/messages',
    protocolKey: 'Anthropic Messages',
    auth: 'x-api-key: sk-…',
    purposeKey: 'Used by Claude Code',
  },
]

/** Anchor ids on the page, in the order the sections appear. */
export const DOCS_SECTION_IDS = [
  'api-key',
  'endpoints',
  'models',
  'tools',
  'troubleshooting',
] as const

export type DocsSectionId = (typeof DOCS_SECTION_IDS)[number]

/** Section id to i18n key for its heading, shared by the body and the index. */
export const DOCS_SECTION_TITLE_KEYS: Record<DocsSectionId, string> = {
  'api-key': 'Get an API Key',
  endpoints: 'API Endpoints',
  models: 'Available Models',
  tools: 'Connect a Tool',
  troubleshooting: 'Troubleshooting',
}

export type FaqItem = {
  id: string
  /** i18n key for the question. */
  questionKey: string
  /** i18n key for the answer. */
  answerKey: string
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'unauthorized',
    questionKey: 'Why do I get 401 Unauthorized?',
    answerKey:
      'The token is missing, mistyped, or disabled. Copy it again from API Keys and send it as Authorization: Bearer sk-… or, on the Anthropic endpoint, as x-api-key: sk-….',
  },
  {
    id: 'balance',
    questionKey: 'Why does the request fail with an insufficient balance?',
    answerKey:
      'The token is valid but the account has no quota left. Top up your balance and retry.',
  },
  {
    id: 'base-url',
    questionKey: 'Should the base URL end with /v1?',
    answerKey:
      'OpenAI-compatible clients want /v1. Anthropic clients such as Claude Code append /v1/messages themselves, so give them the origin only.',
  },
  {
    id: 'model-name',
    questionKey: 'Why is my model name rejected?',
    answerKey:
      'Model ids are matched literally. Send the exact id listed above, including the vendor prefix.',
  },
  {
    id: 'features',
    questionKey: 'Do streaming and tool calling work?',
    answerKey:
      'Yes. The OpenAI routes support server-sent events, tool calls and reasoning output; the Anthropic route supports the equivalent Messages features.',
  },
]
