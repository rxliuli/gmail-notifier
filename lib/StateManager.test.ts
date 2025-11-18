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
})
