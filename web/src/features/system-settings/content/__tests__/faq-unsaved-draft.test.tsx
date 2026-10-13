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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { FAQSection } from '../faq-section'

const SERVER_PAYLOAD = '[{"id":9,"question":"Server entry","answer":"From server"}]'
const UNSAVED_HINT =
  'Edits take effect only after you click "Save Settings"; refreshing now discards them.'

function Fixture(props: { initialData?: string }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [data, setData] = useState(props.initialData ?? '[]')

  return (
    <>
      <div ref={setContainer} />
      {/* Simulates the settings refetch that happens on window focus (staleTime
          5 min) and after any successful option write. */}
      <button type='button' onClick={() => setData(SERVER_PAYLOAD)}>
        Refresh settings data
      </button>
      <SettingsPageProvider actionsContainer={container}>
        <FAQSection enabled data={data} />
      </SettingsPageProvider>
    </>
  )
}

async function renderFaq(initialData?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => <Fixture initialData={initialData} />,
    }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return screen.findByRole('button', { name: 'Add FAQ' })
}

async function addFaq(question: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Add FAQ' }))
  await user.type(screen.getByLabelText('Question'), question)
  await user.type(screen.getByLabelText('Answer'), 'An answer')
  await user.click(screen.getByRole('button', { name: 'Add' }))
  return user
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
})

test('keeps an unsaved entry visible when the settings data refetches', async () => {
  await renderFaq()
  const user = await addFaq('Unsaved question')

  expect(screen.getByText('Unsaved question')).toBeInTheDocument()

  await user.click(
    screen.getByRole('button', { name: 'Refresh settings data' })
  )

  expect(screen.getByText('Unsaved question')).toBeInTheDocument()
  expect(screen.queryByText('Server entry')).not.toBeInTheDocument()
})

test('shows a hint and an enabled save button while entries are unsaved', async () => {
  await renderFaq()
  const saveButton = screen.getByRole('button', { name: 'Save Settings' })

  expect(saveButton).toBeDisabled()
  expect(screen.queryByText(UNSAVED_HINT)).not.toBeInTheDocument()

  await addFaq('Unsaved question')

  expect(screen.getByText(UNSAVED_HINT)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save Settings' })).toBeEnabled()
})

test('writes the whole FAQ list and clears the hint when saved', async () => {
  await renderFaq()
  const user = await addFaq('Saved question')

  await user.click(screen.getByRole('button', { name: 'Save Settings' }))

  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith('/api/option/', {
      key: 'console_setting.faq',
      value: expect.stringContaining('Saved question'),
    })
  )
  await waitFor(() =>
    expect(screen.queryByText(UNSAVED_HINT)).not.toBeInTheDocument()
  )
})

test('adopts the server list once there are no unsaved edits', async () => {
  await renderFaq()
  const user = userEvent.setup()

  await user.click(
    screen.getByRole('button', { name: 'Refresh settings data' })
  )

  expect(await screen.findByText('Server entry')).toBeInTheDocument()
})
