import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fakeBrowser } from '@webext-core/fake-browser'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { mailQueryKey } from '@/lib/useMailQuery'

vi.stubGlobal('browser', fakeBrowser)
// @webext-core/messaging's onMessage() checks for a `chrome` global directly
// (not just `browser`) when registering its listener.
vi.stubGlobal('chrome', fakeBrowser)

const { createAppRouter } = await import('../router')
const { bgMessager } = await import('@/lib/messager')

function makeThread(url: string) {
  return {
    url,
    title: 'Test',
    summary: 'summary',
    modified: '2025-06-03T05:42:00.000Z',
    author: { name: 'Test', email: 'test@test.com' },
  }
}

describe('IndexPage', () => {
  beforeEach(async () => {
    fakeBrowser.reset()
  })

  it('refresh button pulls fresh state directly instead of depending solely on the background push', async () => {
    // Regression test: the refresh button used to only send 'refreshThreads'
    // and wait for background's 'refreshPopup' push to update the view. On
    // Safari that push is delivered over the popup's keepalive port, which
    // disconnects/reconnects often - a push landing mid-gap was silently
    // lost, so the button visibly did nothing until the popup was closed
    // and reopened. This mock simulates exactly that: background finishes
    // the fetch and writes fresh state to storage, but never emits any
    // popupMessager message - the click handler must invalidate/pull the
    // fresh state itself to pass.
    await browser.storage.local.set({ email: 'me@example.com', threads: [makeThread('a')] })
    vi.spyOn(bgMessager, 'sendMessage').mockImplementation(async () => {
      await browser.storage.local.set({ email: 'me@example.com', threads: [makeThread('b')] })
    })

    const queryClient = new QueryClient()
    const screen = await render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={createAppRouter(['/'])} />
      </QueryClientProvider>,
    )
    // Mount's useMailQuery should pick up the pre-seeded thread from storage
    // before any fetch runs.
    await vi.waitUntil(() => queryClient.getQueryData<any>(mailQueryKey)?.threads[0]?.url === 'a')

    await screen.getByTitle('Refresh').click()
    await vi.waitUntil(() => queryClient.getQueryData<any>(mailQueryKey)?.threads[0]?.url === 'b')
    expect(queryClient.getQueryData<any>(mailQueryKey)?.threads[0]?.url).toBe('b')
  })

  it('shows the toolbar (with Debug Log access) even when not logged in', async () => {
    // Regression test: the toolbar used to only render once mailQuery.data
    // had an email, so a separate "Debug Log" button had to be bolted onto
    // the logged-out screen just to keep it reachable. The toolbar is
    // unconditional now, so its own "More" menu (which has Debug Log)
    // works from the logged-out screen too.
    const screen = await render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={createAppRouter(['/'])} />
      </QueryClientProvider>,
    )
    await expect.element(screen.getByTitle('Refresh')).toBeInTheDocument()
    await expect.element(screen.getByText('Please login to Gmail')).toBeInTheDocument()
  })
})
