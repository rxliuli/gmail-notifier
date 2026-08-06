import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { fakeBrowser } from '@webext-core/fake-browser'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useCollapseStore } from '@/lib/collapseStore'
import type { EmailThread } from '@/lib/StateManager'
import type { ThreadMail } from '@/lib/api/gmail'

vi.stubGlobal('browser', fakeBrowser)

const { createAppRouter } = await import('../router')

function makeThread(messageCount: number, overrides: Partial<EmailThread> = {}): EmailThread {
  const messages: ThreadMail['messages'] = Array.from({ length: messageCount }, (_, i) => ({
    senderName: `Sender ${i}`,
    senderEmail: `sender${i}@example.com`,
    time: '2025-06-03T05:42:00.000Z',
    to: ['rxliuli@gmail.com'],
    cc: [],
    contentHtml: `<p>Body ${i}</p>`,
    contentText: `Body ${i}`,
  }))
  return {
    title: 'Test',
    summary: 'summary',
    url: `https://mail.google.com/mail/u/0/?account_id=test@test.com&message_id=abc${messageCount}&view=conv&extsrc=atom`,
    modified: '2025-06-03T05:42:00.000Z',
    author: { name: 'Test', email: 'test@test.com' },
    subject: 'Test Subject',
    messageCount,
    messages,
    styles: [],
    ...overrides,
  }
}

// DetailPage now derives its thread from useMailQuery (storage.local) +
// the route's $threadUrl param instead of a directly-injected store value -
// seed storage and navigate a fresh router straight to that thread's route.
async function renderDetail(thread: EmailThread) {
  await fakeBrowser.storage.local.set({ email: 'me@example.com', threads: [thread] })
  const router = createAppRouter([`/detail/${encodeURIComponent(thread.url)}`])
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

// Every message must end up either directly rendered or accounted for by a
// "N messages collapsed" indicator - none may silently disappear.
function renderedMessageSlots(container: HTMLElement) {
  const messageBlocks = container.querySelectorAll('[data-testid="mail-message"]').length
  const indicator = container.querySelector('[data-testid="collapsed-indicator"]')
  const indicatorCount = indicator ? Number(indicator.getAttribute('data-count')) : 0
  return messageBlocks + indicatorCount
}

describe('DetailPage', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    useCollapseStore.setState({ contentIndexes: new Set(), groupIndexes: new Set(), count: 0 })
  })

  it('hides the collapse-all toggle for a single-message thread', async () => {
    const screen = await renderDetail(makeThread(1))
    await expect.element(screen.getByTitle('Open in Gmail').first()).toBeInTheDocument()
    expect(screen.getByTitle('All Collapsed').query()).toBeNull()
    expect(screen.getByTitle('All Expanded').query()).toBeNull()
  })

  it('shows the collapse-all toggle for a multi-message thread', async () => {
    const screen = await renderDetail(makeThread(3))
    await expect.element(screen.getByTitle('Open in Gmail').first()).toBeInTheDocument()
    const toggle = screen.getByTitle('All Collapsed').query() ?? screen.getByTitle('All Expanded').query()
    expect(toggle).not.toBeNull()
  })

  it.each([2, 3, 4, 5, 6, 7, 8])('accounts for every message with no message count (count=%i)', async (count) => {
    const screen = await renderDetail(makeThread(count))
    await vi.waitUntil(() => renderedMessageSlots(screen.container) > 0)
    expect(renderedMessageSlots(screen.container)).toBe(count)
  })

  it('expanding the collapsed group reveals the hidden messages (count=5)', async () => {
    const screen = await renderDetail(makeThread(5))
    const indicator = screen.getByTestId('collapsed-indicator')
    await expect.element(indicator).toBeInTheDocument()
    await indicator.click()
    expect(screen.getByTestId('collapsed-indicator').query()).toBeNull()
    expect(screen.container.querySelectorAll('[data-testid="mail-message"]').length).toBe(5)
  })

  describe('dark mode', () => {
    // Dark mode is pure CSS now (@media (prefers-color-scheme: dark) in
    // DARK_MODE_FILTER_STYLE) - no next-themes/JS state to force a theme
    // with, so these check the generated CSS itself: that the invert filter
    // is correctly scoped inside the media query (trusting the browser's
    // own well-tested media query engine to gate it at render time), and
    // that the always-on color reset is present regardless of theme.
    let screen: Awaited<ReturnType<typeof render>> | undefined

    afterEach(async () => {
      await screen?.unmount()
      screen = undefined
    })

    it('scopes the invert filter to a prefers-color-scheme: dark media query', async () => {
      screen = await renderDetail(makeThread(1))
      await vi.waitUntil(() => [...screen!.container.querySelectorAll('*')].some((el) => el.shadowRoot))
      const host = [...screen.container.querySelectorAll('*')].find((el) => el.shadowRoot) as HTMLElement
      await vi.waitUntil(() => host.shadowRoot!.adoptedStyleSheets.length > 0)
      const mediaRules = [...host.shadowRoot!.adoptedStyleSheets]
        .flatMap((sheet) => [...sheet.cssRules])
        .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule)
      expect(mediaRules).toHaveLength(1)
      const mediaRule = mediaRules[0]!
      expect(mediaRule.conditionText).toBe('(prefers-color-scheme: dark)')
      expect(mediaRule.cssText).toContain('invert(1)')
    })

    it('does not leak the app dark-mode --foreground into unstyled email text', async () => {
      // Regression test for a real bug: raw email HTML (e.g. makeThread's
      // default `<p>Body</p>`) usually sets no color of its own, expecting
      // the browser's plain black default. `color` is inherited and crosses
      // shadow boundaries, so with nothing resetting it, that text was
      // instead inheriting our OWN app chrome's `body { color:
      // var(--foreground) }` - near-white in dark mode (oklch(0.985 0 0),
      // see style.css). The invert() filter (built assuming content starts
      // from real black-on-white) then flips that near-white to near-black,
      // landing on the black :host background and vanishing entirely -
      // confirmed live via DevTools on a real email before this was fixed
      // with an explicit, always-on `:host { color: #000 }` reset.
      screen = await renderDetail(makeThread(1))
      await vi.waitUntil(() => [...screen!.container.querySelectorAll('*')].some((el) => el.shadowRoot))
      const host = [...screen.container.querySelectorAll('*')].find((el) => el.shadowRoot) as HTMLElement
      await vi.waitUntil(() => host.shadowRoot!.querySelector('p') !== null)
      const unstyledText = host.shadowRoot!.querySelector('p')!
      expect(getComputedStyle(unstyledText).color).toBe('rgb(0, 0, 0)')
    })
  })
})
