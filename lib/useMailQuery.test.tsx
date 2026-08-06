import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fakeBrowser } from '@webext-core/fake-browser'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.stubGlobal('browser', fakeBrowser)

const { useMailQuery, mailQueryKey } = await import('./useMailQuery')

function Probe() {
  const query = useMailQuery()
  return (
    <div data-testid="probe">
      {JSON.stringify({ email: query.data?.email ?? null, threads: query.data?.threads ?? [] })}
    </div>
  )
}

describe('useMailQuery', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('reads whatever background last wrote to storage.local', async () => {
    const threads = [{ url: 'https://mail.google.com/1' }] as any
    await fakeBrowser.storage.local.set({ email: 'me@example.com', threads })
    const screen = await render(
      <QueryClientProvider client={new QueryClient()}>
        <Probe />
      </QueryClientProvider>,
    )
    await expect
      .element(screen.getByTestId('probe'))
      .toHaveTextContent(JSON.stringify({ email: 'me@example.com', threads }))
  })

  it('falls back to null/empty when logged out or storage is empty', async () => {
    const screen = await render(
      <QueryClientProvider client={new QueryClient()}>
        <Probe />
      </QueryClientProvider>,
    )
    await expect
      .element(screen.getByTestId('probe'))
      .toHaveTextContent(JSON.stringify({ email: null, threads: [] }))
  })

  it('invalidating mailQueryKey re-reads storage instead of relying on a manual pull', async () => {
    const queryClient = new QueryClient()
    const screen = await render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    )
    await expect.element(screen.getByTestId('probe')).toHaveTextContent('null')

    const threads = [{ url: 'https://mail.google.com/1' }] as any
    await fakeBrowser.storage.local.set({ email: 'me@example.com', threads })
    await queryClient.invalidateQueries({ queryKey: mailQueryKey })

    await expect
      .element(screen.getByTestId('probe'))
      .toHaveTextContent(JSON.stringify({ email: 'me@example.com', threads }))
  })
})
