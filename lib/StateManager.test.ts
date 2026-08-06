import { beforeEach, describe, expect, it, Mock, vi } from 'vitest'
import { GmailApi, StateManager } from './StateManager'
import { Feed, RSSInfo } from './api/gmail'

describe('StateManager', () => {
  let api: {
    [P in keyof GmailApi]: Mock<GmailApi[P]>
  }
  let feed: Feed
  beforeEach(() => {
    api = {
      checkLoginStatus: vi.fn(),
      getRSS: vi.fn(),
      getThreadMail: vi.fn(),
      markAsRead: vi.fn(),
      markAsUnread: vi.fn(),
      archive: vi.fn(),
      delete: vi.fn(),
      markAsSpam: vi.fn(),
    }
    feed = {
      title: 'test',
      summary: 'test',
      url: 'https://mail.google.com/mail/u/0/?account_id=test@test.com&message_id=1985d2747ab8c227&view=conv&extsrc=atom',
      modified: '2025-07-30T21:05:12Z',
      author: {
        name: 'test',
        email: 'test@test.com',
      },
    }
  })

  // Should not call getThreadMail when there are no new threads
  it('should not call getThreadMail when there are no new threads', async () => {
    const stateManager = new StateManager(api)
    await stateManager.fetchThreads()
    api.checkLoginStatus.mockImplementation(async () => true)
    api.getRSS.mockImplementation(
      async () =>
        ({
          email: 'test@test.com',
          modified: '2025-07-30T21:05:12Z',
          feeds: [feed],
        }) satisfies RSSInfo,
    )
    await stateManager.fetchThreads()
    expect(api.getThreadMail).toBeCalledTimes(1)
    await stateManager.fetchThreads()
    expect(api.getThreadMail).toBeCalledTimes(1)
    await stateManager.fetchThreads(true)
    expect(api.getThreadMail).toBeCalledTimes(2)
  })
  // Should sort threads by modified time
  it('should sort threads by modified time', async () => {
    api.checkLoginStatus.mockImplementation(async () => true)
    api.getRSS.mockImplementation(
      async () =>
        ({
          email: 'test@test.com',
          modified: '2025-07-30T21:05:12Z',
          feeds: [
            {
              ...feed,
              modified: '2025-07-29T21:05:12Z',
            },
            {
              ...feed,
              modified: '2025-07-30T21:05:11Z',
              url: 'https://mail.google.com/mail/u/0/?account_id=test@test.com&message_id=2381d2747ab8c227&view=conv&extsrc=atom',
            },
          ],
        }) satisfies RSSInfo,
    )
    const stateManager = new StateManager(api)
    await stateManager.fetchThreads()
    expect(stateManager.threads.map((it) => it.modified)).toEqual(['2025-07-30T21:05:11Z', '2025-07-29T21:05:12Z'])
  })

  it('should not call the api at all when offline', async () => {
    const onLineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const stateManager = new StateManager(api)
    await stateManager.fetchThreads()
    expect(api.checkLoginStatus).not.toBeCalled()
    expect(api.getRSS).not.toBeCalled()
    onLineSpy.mockRestore()
  })

  it('should notify listeners without fetching RSS when logged out', async () => {
    api.checkLoginStatus.mockImplementation(async () => false)
    const stateManager = new StateManager(api)
    const listener = vi.fn(async () => {})
    stateManager.on(listener)
    await stateManager.fetchThreads()
    expect(stateManager.isLoggedIn).toBe(false)
    expect(api.getRSS).not.toBeCalled()
    expect(listener).toBeCalledTimes(1)
  })

  describe('getNewThreads / getUnreadThreads', () => {
    async function seedOneThread(stateManager: StateManager) {
      api.checkLoginStatus.mockImplementation(async () => true)
      api.getRSS.mockImplementation(
        async () => ({ email: 'test@test.com', modified: feed.modified, feeds: [feed] }) satisfies RSSInfo,
      )
      api.getThreadMail.mockImplementation(async () => ({ subject: 'x', messageCount: 1, messages: [], styles: [] }))
      await stateManager.fetchThreads()
    }

    it('treats a freshly-fetched thread as new while listeners run, then marks it notified', async () => {
      const stateManager = new StateManager(api)
      // getNewThreads() is only meaningful *during* the notify pass (this is how
      // background.ts's notification listener uses it) - notifiedEmails is
      // populated right after listeners run, so checking post-await always sees it cleared.
      const seenDuringNotify: string[] = []
      stateManager.on(async () => {
        seenDuringNotify.push(...stateManager.getNewThreads().map((it) => it.url))
      })
      await seedOneThread(stateManager)
      expect(seenDuringNotify).toEqual([feed.url])
      expect(stateManager.getNewThreads()).toEqual([])
      expect(stateManager.getUnreadThreads().map((it) => it.url)).toEqual([feed.url])
    })

    it('stops treating a thread as new after the next fetch (already notified)', async () => {
      const stateManager = new StateManager(api)
      await seedOneThread(stateManager)
      await seedOneThread(stateManager)
      expect(stateManager.getNewThreads()).toEqual([])
      // Still unread - viewing the popup is what clears this, not re-fetching.
      expect(stateManager.getUnreadThreads().map((it) => it.url)).toEqual([feed.url])
    })

    it('excludes a thread from unread once viewed', async () => {
      const stateManager = new StateManager(api)
      await seedOneThread(stateManager)
      api.markAsRead.mockImplementation(async () => {})
      await stateManager.viewed(feed.url)
      expect(stateManager.getUnreadThreads()).toEqual([])
    })
  })

  describe('mutating actions', () => {
    async function seedOneThread(stateManager: StateManager) {
      api.checkLoginStatus.mockImplementation(async () => true)
      api.getRSS.mockImplementation(
        async () => ({ email: 'test@test.com', modified: feed.modified, feeds: [feed] }) satisfies RSSInfo,
      )
      api.getThreadMail.mockImplementation(async () => ({ subject: 'x', messageCount: 1, messages: [], styles: [] }))
      await stateManager.fetchThreads()
    }

    it('markAsRead removes the thread and calls the api', async () => {
      const stateManager = new StateManager(api)
      await seedOneThread(stateManager)
      api.markAsRead.mockImplementation(async () => {})
      await stateManager.markAsRead(feed.url)
      expect(stateManager.threads).toEqual([])
      expect(api.markAsRead).toBeCalledWith(feed.url)
    })

    it('markAsRead re-syncs via fetchThreads when the api call fails', async () => {
      const stateManager = new StateManager(api)
      await seedOneThread(stateManager)
      api.markAsRead.mockImplementation(async () => {
        throw new Error('network error')
      })
      await stateManager.markAsRead(feed.url)
      // fetchThreads() is fired-and-forgotten from the rejection handler; flush microtasks.
      await new Promise((r) => setTimeout(r, 0))
      expect(api.getRSS).toBeCalledTimes(2)
    })

    it('markAsUnread makes the thread unread again', async () => {
      const stateManager = new StateManager(api)
      await seedOneThread(stateManager)
      api.markAsRead.mockImplementation(async () => {})
      await stateManager.viewed(feed.url)
      expect(stateManager.getUnreadThreads()).toEqual([])
      api.markAsUnread.mockImplementation(async () => {})
      await stateManager.markAsUnread(feed.url)
      expect(stateManager.getUnreadThreads().map((it) => it.url)).toEqual([feed.url])
      expect(api.markAsUnread).toBeCalledWith(feed.url)
    })

    it('archive removes the thread and calls the api', async () => {
      const stateManager = new StateManager(api)
      await seedOneThread(stateManager)
      api.archive.mockImplementation(async () => {})
      await stateManager.archive(feed.url)
      expect(stateManager.threads).toEqual([])
      expect(api.archive).toBeCalledWith(feed.url)
    })

    it('delete removes the thread and calls the api', async () => {
      const stateManager = new StateManager(api)
      await seedOneThread(stateManager)
      api.delete.mockImplementation(async () => {})
      await stateManager.delete(feed.url)
      expect(stateManager.threads).toEqual([])
      expect(api.delete).toBeCalledWith(feed.url)
    })

    it('markAsSpam removes the thread and calls the api', async () => {
      const stateManager = new StateManager(api)
      await seedOneThread(stateManager)
      api.markAsSpam.mockImplementation(async () => {})
      await stateManager.markAsSpam(feed.url)
      expect(stateManager.threads).toEqual([])
      expect(api.markAsSpam).toBeCalledWith(feed.url)
    })

    it('markAllAsRead removes every listed thread', async () => {
      const stateManager = new StateManager(api)
      api.checkLoginStatus.mockImplementation(async () => true)
      const secondFeed: Feed = {
        ...feed,
        url: 'https://mail.google.com/mail/u/0/?account_id=test@test.com&message_id=2381d2747ab8c227&view=conv&extsrc=atom',
      }
      api.getRSS.mockImplementation(
        async () => ({ email: 'test@test.com', modified: feed.modified, feeds: [feed, secondFeed] }) satisfies RSSInfo,
      )
      api.getThreadMail.mockImplementation(async () => ({ subject: 'x', messageCount: 1, messages: [], styles: [] }))
      await stateManager.fetchThreads()
      api.markAsRead.mockImplementation(async () => {})
      await stateManager.markAllAsRead([feed.url, secondFeed.url])
      expect(stateManager.threads).toEqual([])
      expect(api.markAsRead).toBeCalledTimes(2)
    })

    it('clearViewed drops only the threads that were viewed', async () => {
      const stateManager = new StateManager(api)
      api.checkLoginStatus.mockImplementation(async () => true)
      const secondFeed: Feed = {
        ...feed,
        url: 'https://mail.google.com/mail/u/0/?account_id=test@test.com&message_id=2381d2747ab8c227&view=conv&extsrc=atom',
      }
      api.getRSS.mockImplementation(
        async () => ({ email: 'test@test.com', modified: feed.modified, feeds: [feed, secondFeed] }) satisfies RSSInfo,
      )
      api.getThreadMail.mockImplementation(async () => ({ subject: 'x', messageCount: 1, messages: [], styles: [] }))
      await stateManager.fetchThreads()
      api.markAsRead.mockImplementation(async () => {})
      await stateManager.viewed(feed.url)
      await stateManager.clearViewed()
      expect(stateManager.threads.map((it) => it.url)).toEqual([secondFeed.url])
    })
  })

  describe('refresh', () => {
    it('clears viewed state and force-refetches all threads', async () => {
      const stateManager = new StateManager(api)
      api.checkLoginStatus.mockImplementation(async () => true)
      api.getRSS.mockImplementation(
        async () => ({ email: 'test@test.com', modified: feed.modified, feeds: [feed] }) satisfies RSSInfo,
      )
      api.getThreadMail.mockImplementation(async () => ({ subject: 'x', messageCount: 1, messages: [], styles: [] }))
      await stateManager.fetchThreads()
      api.markAsRead.mockImplementation(async () => {})
      await stateManager.viewed(feed.url)
      await stateManager.refresh()
      // Force refetch re-fetches thread details for every feed item again.
      expect(api.getThreadMail).toBeCalledTimes(2)
      expect(stateManager.getUnreadThreads().map((it) => it.url)).toEqual([feed.url])
    })
  })
})
