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
import { ArrowRightLeft, Bird } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { getLobeIcon } from '@/lib/lobe-icon'

import { ToolGuideCard, type ToolGuideStep } from './tool-guide-card'

interface ToolGuidesProps {
  /** Gateway origin without a trailing slash, e.g. `https://example.com`. */
  origin: string
  /** Origin with the OpenAI-compatible `/v1` suffix. */
  openAiBaseUrl: string
}

export function ToolGuides(props: ToolGuidesProps) {
  const { t } = useTranslation()

  const steps = useMemo(() => {
    const ccSwitch: ToolGuideStep[] = [
      {
        text: t('Install CC Switch from its official site, then open it.'),
        snippet: {
          label: 'install',
          code: `# macOS\nbrew install --cask cc-switch\n\n# All platforms\n# https://ccswitch.io/zh/`,
        },
      },
      {
        text: t(
          'Open API Keys, open the row actions menu of the key you want to use, and choose "CC Switch".'
        ),
      },
      {
        text: t(
          'Pick the target app, choose a primary model, then click Open CC Switch.'
        ),
      },
      {
        text: t('Confirm the import in CC Switch, then enable the provider.'),
      },
    ]

    const magpie: ToolGuideStep[] = [
      {
        text: t('Install Magpie from its official site, then open it.'),
        snippet: {
          label: 'install',
          code: '# https://usemagpie.ai/zh/',
        },
      },
      {
        text: t(
          'Add a custom provider with this base URL, choose the OpenAI protocol, and paste your API key.'
        ),
        snippet: { label: 'Base URL', code: props.openAiBaseUrl },
      },
      {
        text: t('Switch the model for your agent to a model from this gateway.'),
      },
    ]

    const harness: ToolGuideStep[] = [
      { text: t('Open Settings, then Models.') },
      {
        text: t('Click Add model provider and choose Custom model API.'),
      },
      {
        text: t(
          'Set a Provider ID, paste this base URL, and choose OpenAI Chat Completions as the API protocol.'
        ),
        snippet: { label: 'Base URL', code: props.openAiBaseUrl },
      },
      {
        text: t(
          'Paste your API key, then click Fetch available models and add the ids you want.'
        ),
      },
      { text: t('Apply, then choose the model in the composer.') },
      {
        text: t(
          'To declare the provider in the config file instead, add this to cordis.patch.yml.'
        ),
        snippet: {
          label: 'cordis.patch.yml',
          code: `- id: llm-pi-ai
  name: '@deepseek-ai/dsh-llm-pi-ai'
  config:
    providers:
      jingyu-api:
        displayName: Jingyu API
        apiKeyEnv: JINGYU_API_KEY
        api: openai-completions
        baseURL: ${props.openAiBaseUrl}
        models:
          - id: MODEL_ID
            name: MODEL_ID`,
        },
      },
    ]

    const codex: ToolGuideStep[] = [
      {
        text: t(
          'Codex reads providers from ~/.codex/config.toml and takes the key from the environment.'
        ),
        snippet: {
          label: '~/.codex/config.toml',
          code: `model = "MODEL_ID"
model_provider = "jingyu-api"

[model_providers.jingyu-api]
name = "Jingyu API"
base_url = "${props.openAiBaseUrl}"
wire_api = "responses"
env_key = "JINGYU_API_KEY"`,
        },
      },
      {
        text: t('Export the key in the shell you launch Codex from.'),
        snippet: {
          label: 'shell',
          code: `export JINGYU_API_KEY=sk-xxxxxxxx      # macOS / Linux / WSL
$env:JINGYU_API_KEY = "sk-xxxxxxxx"    # PowerShell`,
        },
      },
    ]

    const claudeCode: ToolGuideStep[] = [
      {
        text: t(
          'Add this env block to ~/.claude/settings.json, or export the same variables in your shell.'
        ),
        snippet: {
          label: '~/.claude/settings.json',
          code: `{
  "env": {
    "ANTHROPIC_BASE_URL": "${props.origin}",
    "ANTHROPIC_API_KEY": "sk-xxxxxxxx",
    "ANTHROPIC_MODEL": "MODEL_ID"
  }
}`,
        },
      },
      {
        text: t(
          'Pin the model. Claude Code only lists discovered ids that contain claude or anthropic, so leave ANTHROPIC_MODEL set.'
        ),
      },
      {
        text: t(
          'On the first interactive run, approve the key when Claude Code asks for it.'
        ),
      },
    ]

    return { ccSwitch, magpie, harness, codex, claudeCode }
  }, [t, props.origin, props.openAiBaseUrl])

  return (
    <div className='space-y-4'>
      <ToolGuideCard
        name={t('CC Switch')}
        logo={<ArrowRightLeft />}
        intro={t(
          'Installs this gateway as a provider for Claude Code, Codex and Gemini CLI, and rewrites each tool config file for you.'
        )}
        steps={steps.ccSwitch}
        recommended
        anchorId='cc-switch'
        footnote={t(
          'Claude Code switches immediately. Restart Codex and Gemini CLI after switching.'
        )}
      />

      <ToolGuideCard
        name={t('Magpie')}
        logo={<Bird className='shrink-0' aria-hidden='true' />}
        intro={t(
          'Magpie is a local switcher that lets Claude Code, Codex and Gemini CLI use any provider. Add this gateway once and switch models per agent.'
        )}
        steps={steps.magpie}
        anchorId='magpie'
        footnote={t(
          'Restart the agent after switching; most tools read their config at startup.'
        )}
      />

      <ToolGuideCard
        name={t('DeepSeek Harness')}
        logo={<span className='shrink-0'>{getLobeIcon('DeepSeek.Color', 20)}</span>}
        intro={t(
          'DeepSeek Harness declares providers in its Models settings page. Add this gateway once and every agent preset can use it.'
        )}
        steps={steps.harness}
        anchorId='deepseek-harness'
        footnote={t('If the fetch fails, add the model ids by hand instead.')}
      />

      <ToolGuideCard
        name={t('Codex')}
        logo={<span className='shrink-0'>{getLobeIcon('Codex.Color', 20)}</span>}
        intro={t(
          'Codex needs a model that serves the Responses API, so it cannot use models listed above as chat-only.'
        )}
        steps={steps.codex}
        anchorId='codex'
        footnote={t(
          'Keep wire_api = "responses"; this gateway serves the Responses API natively, so no local routing is needed.'
        )}
      />

      <ToolGuideCard
        name={t('Claude Code')}
        logo={<span className='shrink-0'>{getLobeIcon('ClaudeCode.Color', 20)}</span>}
        intro={t(
          'Claude Code reads its endpoint and credential from the environment, and takes the origin only.'
        )}
        steps={steps.claudeCode}
        anchorId='claude-code'
        footnote={t(
          'Do not append /v1 to the base URL; Claude Code already posts to /v1/messages, so a suffix produces /v1/v1/messages.'
        )}
      />
    </div>
  )
}
