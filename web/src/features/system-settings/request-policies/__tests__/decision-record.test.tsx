import { render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { expect, it } from 'vitest'

import { PolicyDecisionRecord } from '../decision-record'

const failedAttempt = {
  attempt: 1,
  channel_id: 11,
  group: 'default',
  status: 429,
  error_code: 'bad_response_status_code',
  error_source: 'upstream',
  elapsed_ms: 5200,
  ttft_ms: 1500,
  decision: { action: 'failure', reason: 'upstream_failure', source: 'upstream' },
}

const answeredAttempt = {
  attempt: 2,
  channel_id: 12,
  group: 'default',
  elapsed_ms: 900,
  ttft_ms: 900,
  decision: {
    action: 'success',
    reason: 'request_completed',
    source: 'upstream',
  },
}

const retryDecision = {
  attempt: 1,
  channel_id: 11,
  group: 'default',
  elapsed_ms: 5200,
  decision: { action: 'retry', reason: 'retry_status_matched', source: 'global' },
}

it('shows each attempt its own first-token latency', () => {
  const label = i18next.t('First token')
  render(
    <PolicyDecisionRecord
      events={[failedAttempt, retryDecision, answeredAttempt]}
    />
  )

  const items = screen.getAllByRole('listitem')
  expect(items).toHaveLength(3)
  expect(items[0].textContent).toContain(`${label} 1500 ms`)
  expect(items[2].textContent).toContain(`${label} 900 ms`)
  // The attempt's decision mirror and attempts that never answered carry no TTFT.
  expect(items[1].textContent).not.toContain(label)
  expect(items[1].textContent).toContain('5200 ms')
})

it('keeps the elapsed time intact when no attempt reported a first token', () => {
  const label = i18next.t('First token')
  render(<PolicyDecisionRecord events={[{ ...retryDecision, ttft_ms: 0 }]} />)

  const [item] = screen.getAllByRole('listitem')
  expect(item.textContent).toContain('5200 ms')
  expect(item.textContent).not.toContain(label)
})
