import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useEffect } from 'react'
import { render } from 'vitest-browser-react'
import { DetailPage } from './DetailPage'
import { useMailStore } from '@/lib/mailStore'
import { useCollapseStore } from '@/lib/collapseStore'
import type { EmailThread } from '@/lib/StateManager'
import type { ThreadMail } from '@/lib/api/gmail'
import { ThemeProvider, useTheme } from '@/integrations/theme/ThemeProvider'
import { ShadowProvider } from '@/integrations/shadow/ShadowProvider'

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
    url: 'https://mail.google.com/mail/u/0/?account_id=test@test.com&message_id=abc123&view=conv&extsrc=atom',
    modified: '2025-06-03T05:42:00.000Z',
    author: { name: 'Test', email: 'test@test.com' },
    subject: 'Test Subject',
    messageCount,
    messages,
    styles: [],
    ...overrides,
  }
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
    useCollapseStore.setState({ contentIndexes: new Set(), groupIndexes: new Set(), count: 0 })
    useMailStore.setState({ path: 'list', thread: null })
  })

  it('hides the collapse-all toggle for a single-message thread', async () => {
    useMailStore.setState({ path: 'detail', thread: makeThread(1) })
    const screen = await render(<DetailPage />)
    await expect.element(screen.getByTitle('Open in Gmail').first()).toBeInTheDocument()
    expect(screen.getByTitle('All Collapsed').query()).toBeNull()
    expect(screen.getByTitle('All Expanded').query()).toBeNull()
  })

  it('shows the collapse-all toggle for a multi-message thread', async () => {
    useMailStore.setState({ path: 'detail', thread: makeThread(3) })
    const screen = await render(<DetailPage />)
    const toggle = screen.getByTitle('All Collapsed').query() ?? screen.getByTitle('All Expanded').query()
    expect(toggle).not.toBeNull()
  })

  it.each([2, 3, 4, 5, 6, 7, 8])('accounts for every message with no message count (count=%i)', async (count) => {
    useMailStore.setState({ path: 'detail', thread: makeThread(count) })
    const screen = await render(<DetailPage />)
    expect(renderedMessageSlots(screen.container)).toBe(count)
  })

  it('expanding the collapsed group reveals the hidden messages (count=5)', async () => {
    useMailStore.setState({ path: 'detail', thread: makeThread(5) })
    const screen = await render(<DetailPage />)
    const indicator = screen.getByTestId('collapsed-indicator')
    await expect.element(indicator).toBeInTheDocument()
    await indicator.click()
    expect(screen.getByTestId('collapsed-indicator').query()).toBeNull()
    expect(screen.container.querySelectorAll('[data-testid="mail-message"]').length).toBe(5)
  })

  describe('dark mode', () => {
    function ForceTheme(props: { theme: string }) {
      const { setTheme } = useTheme()
      useEffect(() => setTheme(props.theme), [props.theme])
      return null
    }

    let screen: Awaited<ReturnType<typeof render>> | undefined

    beforeEach(() => {
      localStorage.clear()
      document.body.classList.remove('light', 'dark')
    })

    afterEach(async () => {
      await screen?.unmount()
      screen = undefined
    })

    it('inverts the raw email HTML so it stays readable on a dark background', async () => {
      useMailStore.setState({ path: 'detail', thread: makeThread(1) })
      screen = await render(
        <ShadowProvider container={document.body}>
          <ThemeProvider>
            <ForceTheme theme="dark" />
            <DetailPage />
          </ThemeProvider>
        </ShadowProvider>,
      )
      const host = [...screen.container.querySelectorAll('*')].find((el) => el.shadowRoot) as HTMLElement
      await vi.waitUntil(() => getComputedStyle(host).filter !== 'none')
      expect(getComputedStyle(host).filter).not.toBe('none')
    })

    it('leaves the raw email HTML untouched in light mode', async () => {
      useMailStore.setState({ path: 'detail', thread: makeThread(1) })
      screen = await render(
        <ShadowProvider container={document.body}>
          <ThemeProvider>
            <ForceTheme theme="light" />
            <DetailPage />
          </ThemeProvider>
        </ShadowProvider>,
      )
      const host = [...screen.container.querySelectorAll('*')].find((el) => el.shadowRoot) as HTMLElement
      await vi.waitUntil(() => document.body.classList.contains('light'))
      expect(getComputedStyle(host).filter).toBe('none')
    })
  })
})
