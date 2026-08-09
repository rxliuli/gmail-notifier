import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  extractThreadMail,
  extractRSS,
  formatDate,
  getOpenWebLink,
  getGmailAt,
  getRSS,
  detectActiveSlot,
  parseAccountSlot,
  parseAddressField,
  extractGmailInfo,
  parseReplyTo,
  type Feed,
  type ThreadMail,
} from './gmail'
import { parseDocument, parseFeed } from 'htmlparser2'
import { selectOne } from 'css-select'

describe('extractRSS', () => {
  it('empty', () => {
    const str = `<?xml version="1.0" encoding="UTF-8"?><feed version="0.3" xmlns="http://purl.org/atom/ns#"><title>Gmail - Inbox for rxliuli@gmail.com</title><tagline>New messages in your Gmail Inbox</tagline><fullcount>0</fullcount><link rel="alternate" href="https://mail.google.com/mail/u/0" type="text/html"/><modified>2025-06-03T09:23:46Z</modified></feed>`
    const rss = extractRSS(str)
    expect(rss).toEqual({
      email: 'rxliuli@gmail.com',
      modified: '2025-06-03T09:23:46Z',
      feeds: [],
    })
  })
  const author = {
    name: '璃 琉',
    email: 'rxliuli@outlook.com',
  }
  it('plain text', () => {
    const str = `<?xml version="1.0" encoding="UTF-8"?><feed version="0.3" xmlns="http://purl.org/atom/ns#"><title>Gmail - Inbox for rxliuli@gmail.com</title><tagline>New messages in your Gmail Inbox</tagline><fullcount>1</fullcount><link rel="alternate" href="https://mail.google.com/mail/u/1" type="text/html"/><modified>2025-06-03T09:41:12Z</modified><entry><title>Test Text</title><summary>Test PlainText</summary><link rel="alternate" href="https://mail.google.com/mail/u/1?account_id=rxliuli@gmail.com&amp;message_id=19734500f9fb78da&amp;view=conv&amp;extsrc=atom" type="text/html"/><modified>2025-06-03T05:42:31Z</modified><issued>2025-06-03T05:42:31Z</issued><id>tag:gmail.google.com,2004:1833885343766247642</id><author><name>璃 琉</name><email>rxliuli@outlook.com</email></author></entry></feed>`
    const feeds = extractRSS(str).feeds
    expect(feeds).toEqual([
      {
        title: 'Test Text',
        summary: 'Test PlainText',
        url: 'https://mail.google.com/mail/u/1?account_id=rxliuli@gmail.com&message_id=19734500f9fb78da&view=conv&extsrc=atom',
        modified: '2025-06-03T05:42:31Z',
        author,
      } satisfies Feed,
    ])
  })
  it('html', () => {
    const str = `<?xml version="1.0" encoding="UTF-8"?><feed version="0.3" xmlns="http://purl.org/atom/ns#"><title>Gmail - Inbox for rxliuli@gmail.com</title><tagline>New messages in your Gmail Inbox</tagline><fullcount>1</fullcount><link rel="alternate" href="https://mail.google.com/mail/u/0" type="text/html"/><modified>2025-06-03T09:49:33Z</modified><entry><title>Test HTML</title><summary>Hello World</summary><link rel="alternate" href="https://mail.google.com/mail/u/0?account_id=rxliuli@gmail.com&amp;message_id=1973531a7027620c&amp;view=conv&amp;extsrc=atom" type="text/html"/><modified>2025-06-03T09:48:55Z</modified><issued>2025-06-03T09:48:55Z</issued><id>tag:gmail.google.com,2004:1833900846285808140</id><author><name>璃 琉</name><email>rxliuli@outlook.com</email></author></entry></feed>`
    const feeds = extractRSS(str).feeds
    expect(feeds).toEqual([
      {
        title: 'Test HTML',
        summary: 'Hello World',
        url: 'https://mail.google.com/mail/u/0?account_id=rxliuli@gmail.com&message_id=1973531a7027620c&view=conv&extsrc=atom',
        modified: '2025-06-03T09:48:55Z',
        author,
      },
    ])
  })
  it('image', () => {
    const str = `<?xml version="1.0" encoding="UTF-8"?><feed version="0.3" xmlns="http://purl.org/atom/ns#"><title>Gmail - Inbox for rxliuli@gmail.com</title><tagline>New messages in your Gmail Inbox</tagline><fullcount>1</fullcount><link rel="alternate" href="https://mail.google.com/mail/u/0" type="text/html"/><modified>2025-06-03T10:03:58Z</modified><entry><title>Test Image</title><summary></summary><link rel="alternate" href="https://mail.google.com/mail/u/0?account_id=rxliuli@gmail.com&amp;message_id=19734a32806f59c1&amp;view=conv&amp;extsrc=atom" type="text/html"/><modified>2025-06-03T07:13:17Z</modified><issued>2025-06-03T07:13:17Z</issued><id>tag:gmail.google.com,2004:1833891054033525185</id><author><name>璃 琉</name><email>rxliuli@outlook.com</email></author></entry></feed>`
    const feeds = extractRSS(str).feeds
    expect(feeds).toEqual([
      {
        title: 'Test Image',
        summary: '',
        url: 'https://mail.google.com/mail/u/0?account_id=rxliuli@gmail.com&message_id=19734a32806f59c1&view=conv&extsrc=atom',
        modified: '2025-06-03T07:13:17Z',
        author,
      } satisfies Feed,
    ])
  })
  it.todo('attachment')
})

describe('extractContent', () => {
  it('plain text', async () => {
    const content = (await import('./assets/content-plaintext.html?raw')).default
    const mail = extractThreadMail(content)
    expect(mail.subject).eq('Test Text')
    expect(mail.messages[0]!.senderName).eq('璃 琉')
    expect(mail.messages[0]!.senderEmail).eq('rxliuli@outlook.com')
    expect(mail.messages[0]!.time).eq('2025-06-03T05:42:00.000Z')
    expect(mail.messages[0]!.to).toEqual(['rxliuli@gmail.com'])
    expect(mail.messages[0]!.cc).toEqual([])
    expect(mail.messages[0]!.replyTo).undefined
    expect(mail.messages[0]!.contentHtml).includes('Test PlainText')
  })
  it('html', async () => {
    const content = (await import('./assets/content-html.html?raw')).default
    const mail = extractThreadMail(content)
    expect(mail.subject).eq('Test HTML')
    expect(mail.messages[0]!.contentHtml).includes('<i>Hello</i>').includes('<b>World</b>')
  })
  it('extracts <style> tags from the document', async () => {
    const content = (await import('./assets/content-html.html?raw')).default
    const mail = extractThreadMail(content)
    expect(mail.styles).length(2)
    expect(mail.styles[0]).includes('font-family: arial, sans-serif')
    expect(mail.styles[1]).includes('.logo')
  })
  it('image', async () => {
    const content = (await import('./assets/content-image.html?raw')).default
    const main = extractThreadMail(content, 'https://mail.google.com/mail/u/0')
    const html = main.messages[0]!.contentHtml
    expect(html).includes('<img')
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const img = doc.querySelector('img') as HTMLImageElement
    expect(img.src).include('https://mail.google.com/mail/u/0')
  })
  it.todo('attachment')
  it('reply', async () => {
    const content = (await import('./assets/content-reply.html?raw')).default
    const mail = extractThreadMail(content, 'https://mail.google.com/mail/u/0')
    expect(mail.messages).length(mail.messageCount)
  })
})

describe('tools', () => {
  it('formatDate', () => {
    expect(formatDate('Tue, Jun 3, 2025 at 10:12 AM')).eq('2025-06-03T02:12:00.000Z')
  })
})

describe('getOpenWebLink', () => {
  it('normal', () => {
    expect(
      getOpenWebLink(
        'https://mail.google.com/mail/u/0?account_id=rxliuli@gmail.com&message_id=19734500f9fb78da&view=conv&extsrc=atom',
      ),
    ).eq('https://mail.google.com/mail/u/0/#inbox/19734500f9fb78da')
  })
})

describe('parseAddressField', () => {
  it('parses a single "name" <email> pair', () => {
    expect(parseAddressField('&quot;Liuli RX&quot;&lt;rxliuli@gmail.com&gt;')).toEqual([
      'Liuli RX <rxliuli@gmail.com>',
    ])
  })
  it('parses multiple comma-separated addresses', () => {
    expect(
      parseAddressField('&quot;A&quot;&lt;a@x.com&gt;, &quot;B&quot;&lt;b@y.com&gt;'),
    ).toEqual(['A <a@x.com>', 'B <b@y.com>'])
  })
  it('parses a bare address with no display name', () => {
    expect(parseAddressField('&lt;a@x.com&gt;')).toEqual(['a@x.com'])
  })
  it('collapses a display name that is just the email address', () => {
    expect(parseAddressField('&quot;a@x.com&quot;&lt;a@x.com&gt;')).toEqual(['a@x.com'])
  })
  it('falls back to a bare regex match when there are no angle brackets', () => {
    expect(parseAddressField('a@x.com')).toEqual(['a@x.com'])
  })
  it('returns an empty array for empty input', () => {
    expect(parseAddressField('')).toEqual([])
  })
})

describe('extractGmailInfo', () => {
  it('parses the u/<n> form with a message_id', () => {
    expect(
      extractGmailInfo(
        'https://mail.google.com/mail/u/0?account_id=rxliuli@gmail.com&message_id=19734500f9fb78da&view=conv',
      ),
    ).toEqual({ n: '0', thread: '19734500f9fb78da' })
  })
  it('parses the compatible u=<n> form', () => {
    expect(extractGmailInfo('https://mail.google.com/mail/u=1/?message_id=abc123')).toEqual({
      n: '1',
      thread: 'abc123',
    })
  })
  it('returns null when there is no message_id', () => {
    expect(extractGmailInfo('https://mail.google.com/mail/u/0?view=conv')).toBeNull()
  })
})

describe('parseReplyTo', () => {
  const thread: ThreadMail = {
    subject: 'Test',
    messageCount: 2,
    styles: [],
    messages: [
      {
        senderName: 'Me',
        senderEmail: 'me@gmail.com',
        time: '2025-06-03T05:42:00.000Z',
        to: ['them@example.com'],
        cc: [],
        contentHtml: '',
      },
      {
        senderName: 'Them',
        senderEmail: 'them@example.com',
        time: '2025-06-03T06:00:00.000Z',
        to: ['me@gmail.com'],
        cc: [],
        contentHtml: '',
      },
    ],
  }
  it('returns the other participant when the thread has one', () => {
    expect(parseReplyTo(thread, 'me@gmail.com')).toEqual({ email: 'them@example.com', name: 'Them' })
  })
  it('returns undefined when every message is from "me"', () => {
    const selfOnly: ThreadMail = { ...thread, messages: [thread.messages[0]!] }
    expect(parseReplyTo(selfOnly, 'me@gmail.com')).toBeUndefined()
  })
})

describe('getGmailAt', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the cookie value when the default store lookup finds it (Chrome/Firefox)', async () => {
    const get = vi.fn().mockResolvedValue({ value: 'at-token' })
    const getAllCookieStores = vi.fn()
    vi.stubGlobal('browser', { cookies: { get, getAllCookieStores } })

    expect(await getGmailAt('0')).eq('at-token')
    expect(getAllCookieStores).not.toBeCalled()
  })

  it('falls back to searching every cookie store when the default lookup is empty (Safari)', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(undefined) // default (no storeId) lookup
      .mockResolvedValueOnce(undefined) // first store
      .mockResolvedValueOnce({ value: 'at-token' }) // second store
    const getAllCookieStores = vi.fn().mockResolvedValue([{ id: 'store-1' }, { id: 'store-2' }])
    vi.stubGlobal('browser', { cookies: { get, getAllCookieStores } })

    expect(await getGmailAt('0')).eq('at-token')
    expect(get).toHaveBeenNthCalledWith(2, expect.objectContaining({ storeId: 'store-1' }))
    expect(get).toHaveBeenNthCalledWith(3, expect.objectContaining({ storeId: 'store-2' }))
  })

  it('returns undefined when the cookie exists in no store', async () => {
    const get = vi.fn().mockResolvedValue(undefined)
    const getAllCookieStores = vi.fn().mockResolvedValue([{ id: 'store-1' }])
    vi.stubGlobal('browser', { cookies: { get, getAllCookieStores } })

    expect(await getGmailAt('0')).toBeUndefined()
  })
})

describe('parseAccountSlot', () => {
  it('extracts the slot from mail and sync URLs alike', () => {
    expect(parseAccountSlot('https://mail.google.com/mail/u/0/feed/atom')).eq('0')
    expect(parseAccountSlot('https://mail.google.com/mail/u/12/?fs=1')).eq('12')
    expect(parseAccountSlot('https://mail.google.com/sync/u/1/i/s?hl=en')).eq('1')
    expect(parseAccountSlot('https://mail.google.com/mail/u/3')).eq('3')
    expect(parseAccountSlot('https://mail.google.com/mail/u/1#inbox')).eq('1')
  })
  it('returns null when no slot is present (e.g. redirected to the login page)', () => {
    expect(parseAccountSlot('https://accounts.google.com/ServiceLogin?service=mail')).toBeNull()
    expect(parseAccountSlot('https://mail.google.com/mail/')).toBeNull()
  })
})

describe('multi-account slot resolution', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function feedXml(email: string, entries: { messageId: string; entrySlot?: string }[]) {
    const entryXml = entries
      .map(
        ({ messageId, entrySlot = '0' }) =>
          `<entry><title>t</title><summary>s</summary><link rel="alternate" href="https://mail.google.com/mail/u/${entrySlot}?account_id=${email}&amp;message_id=${messageId}&amp;view=conv&amp;extsrc=atom" type="text/html"/><modified>2025-06-03T05:42:31Z</modified><issued>2025-06-03T05:42:31Z</issued><id>tag:gmail.google.com,2004:1</id><author><name>n</name><email>a@b.com</email></author></entry>`,
      )
      .join('')
    return `<?xml version="1.0" encoding="UTF-8"?><feed version="0.3" xmlns="http://purl.org/atom/ns#"><title>Gmail - Inbox for ${email}</title><tagline>New messages</tagline><fullcount>${entries.length}</fullcount><link rel="alternate" href="https://mail.google.com/mail/u/0" type="text/html"/><modified>2025-06-03T09:23:46Z</modified>${entryXml}</feed>`
  }

  function stubBrowser(options: { activeSlot?: string; tabs?: { url: string; active?: boolean; lastAccessed?: number }[] }) {
    const data: Record<string, unknown> = options.activeSlot !== undefined ? { activeSlot: options.activeSlot } : {}
    vi.stubGlobal('browser', {
      storage: {
        local: {
          get: vi.fn(async (key: string | string[]) => {
            const keys = Array.isArray(key) ? key : [key]
            return Object.fromEntries(keys.map((k) => [k, data[k]]))
          }),
          set: vi.fn(async (obj: Record<string, unknown>) => {
            Object.assign(data, obj)
          }),
        },
      },
      tabs: {
        query: vi.fn(async () => options.tabs ?? []),
      },
    })
    return data
  }

  function feedResponse(requestedSlot: string, servedSlot: string | null, body: string) {
    return {
      ok: true,
      status: 200,
      redirected: requestedSlot !== servedSlot,
      url:
        servedSlot === null
          ? 'https://accounts.google.com/ServiceLogin?service=mail'
          : `https://mail.google.com/mail/u/${servedSlot}/feed/atom`,
      headers: new Headers(),
      text: async () => body,
    }
  }

  it('fetches the remembered slot and rewrites entry urls onto it', async () => {
    // Confirmed live: the feed's entry links hardcode /u/0 no matter which
    // slot served the feed - without the rewrite, actions on a non-default
    // account would target account 0.
    const data = stubBrowser({ activeSlot: '1' })
    const fetchMock = vi.fn(async (url: string) =>
      feedResponse('1', '1', feedXml('test@gmail.com', [{ messageId: 'abc', entrySlot: '0' }])),
    )
    vi.stubGlobal('fetch', fetchMock)

    const rss = await getRSS()
    expect(fetchMock.mock.calls[0]![0]).toContain('/mail/u/1/feed/atom')
    expect(rss.email).eq('test@gmail.com')
    expect(rss.feeds[0]!.url).toContain('/u/1?account_id=')
    expect(data['activeSlot']).eq('1')
  })

  it('falls back to slot 0 when the remembered slot has signed out', async () => {
    // Confirmed live: requesting an out-of-range slot 302s to u/0's feed
    // rather than erroring - resp.url is the only tell.
    const data = stubBrowser({ activeSlot: '2' })
    const fetchMock = vi.fn(async (url: string) => {
      const slot = parseAccountSlot(url)!
      return slot === '2'
        ? feedResponse('2', '0', feedXml('primary@gmail.com', []))
        : feedResponse('0', '0', feedXml('primary@gmail.com', [{ messageId: 'xyz' }]))
    })
    vi.stubGlobal('fetch', fetchMock)

    const rss = await getRSS()
    expect(rss.email).eq('primary@gmail.com')
    expect(fetchMock).toBeCalledTimes(2)
    expect(data['activeSlot']).eq('0')
  })

  it('prefers the most recently active Gmail tab over the stored slot', async () => {
    stubBrowser({
      activeSlot: '0',
      tabs: [
        { url: 'https://mail.google.com/mail/u/0/#inbox', active: false, lastAccessed: 100 },
        { url: 'https://mail.google.com/mail/u/1/#inbox', active: true, lastAccessed: 200 },
      ],
    })
    expect(await detectActiveSlot()).eq('1')
  })

  it('uses the stored slot when no Gmail tab is open', async () => {
    stubBrowser({ activeSlot: '3', tabs: [] })
    expect(await detectActiveSlot()).eq('3')
  })

  it('defaults to slot 0 with no signal at all', async () => {
    stubBrowser({})
    expect(await detectActiveSlot()).eq('0')
  })
})
