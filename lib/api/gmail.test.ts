import { describe, it, expect } from 'vitest'
import {
  extractThreadMail,
  extractRSS,
  formatDate,
  getOpenWebLink,
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
