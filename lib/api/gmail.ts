import { last } from 'es-toolkit'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { Lru } from 'toad-cache'
import { parse } from 'parse5'
import {
  getAttribute,
  getInnerHTML,
  getParentElement,
  getTextContent,
  querySelector,
  querySelectorAll,
  setAttribute,
} from '../domutils'
import { decodeHTML } from 'entities'
import { debugLog } from '../debugLog'

dayjs.extend(customParseFormat)

export interface Feed {
  title: string
  summary: string
  url: string
  modified: string
  author: {
    name: string
    email: string
  }
}

export interface RSSInfo {
  email: string
  modified: string
  feeds: Feed[]
}

export function extractRSS(text: string): RSSInfo {
  const doc = parse(text)
  const entries = querySelectorAll('entry', doc)
  const feeds = [...entries]
    .map((entry) => {
      const title = getTextContent(querySelector('title', entry)) || ''
      const url = getAttribute(querySelector('link', entry), 'href')
      const summary = getTextContent(querySelector('summary', entry)) || ''
      if (!url) {
        throw new Error('url not found')
      }
      const modified = getTextContent(querySelector('modified', entry))
      const name = getTextContent(querySelector('author > name', entry))
      const email = getTextContent(querySelector('author > email', entry))
      if (!modified || !name || !email) {
        throw new Error('modified or name or email not found')
      }
      return {
        title,
        summary,
        url,
        modified,
        author: { name, email },
      } satisfies Feed
    })
    .filter(Boolean) as Feed[]
  const modified = getTextContent(querySelector('modified', doc))
  const title = getTextContent(querySelector('title', doc))
  if (!modified || !title) {
    throw new Error('modified or title or baseUrl not found')
  }
  const email = last(title.split(' '))
  if (!email) {
    throw new Error('email not found')
  }
  return {
    email,
    modified,
    feeds,
  }
}

// Gmail assigns each signed-in account a slot in the URL path (/mail/u/0,
// /mail/u/1, ...) by sign-in order. Everything below used to hardcode slot 0,
// which pinned the extension to whichever account signed in first and
// silently ignored the account the user actually switched to.
export function parseAccountSlot(url: string): string | null {
  return url.match(/\/u\/(\d+)([/?#]|$)/)?.[1] ?? null
}

const ACTIVE_SLOT_KEY = 'activeSlot'

export async function getStoredActiveSlot(): Promise<string> {
  const { [ACTIVE_SLOT_KEY]: slot } = await browser.storage.local.get<{ [ACTIVE_SLOT_KEY]?: string }>(ACTIVE_SLOT_KEY)
  return slot ?? '0'
}

// Returns true when this actually changed the stored slot - background uses
// that to trigger an immediate refetch on account switches.
export async function rememberActiveSlot(slot: string): Promise<boolean> {
  const prev = await getStoredActiveSlot()
  if (prev === slot) {
    return false
  }
  await browser.storage.local.set({ [ACTIVE_SLOT_KEY]: slot })
  return true
}

// Which account's inbox should the extension reflect? In order:
// 1. The Gmail tab the user most recently had active - the clearest signal
//    of intent, and the one that makes "I switched accounts in Gmail" just
//    work. (On Chrome/Firefox the background's sync-ping listener usually
//    gets there first; this covers Safari, where webRequest never fires,
//    and the service worker having been asleep during the switch.)
// 2. The last slot observed via either signal, persisted across restarts.
// 3. Slot 0, Gmail's default account.
export async function detectActiveSlot(): Promise<string> {
  try {
    const tabs = await browser.tabs.query({ url: 'https://mail.google.com/*' })
    const candidates = tabs
      .map((tab) => ({ tab, slot: tab.url ? parseAccountSlot(tab.url) : null }))
      .filter((it): it is { tab: (typeof tabs)[number]; slot: string } => it.slot !== null)
    if (candidates.length > 0) {
      // lastAccessed is missing on some browsers - fall back to preferring
      // the active tab. Consistent within any one browser, which is all the
      // comparison needs.
      const score = (tab: (typeof tabs)[number]) => tab.lastAccessed ?? (tab.active ? 1 : 0)
      candidates.sort((a, b) => score(b.tab) - score(a.tab))
      return candidates[0]!.slot
    }
  } catch (err) {
    await debugLog('detectActiveSlot: tabs query failed ->', err)
  }
  return getStoredActiveSlot()
}

async function fetchFeedForSlot(slot: string): Promise<RSSInfo | null> {
  const resp = await fetch(`https://mail.google.com/mail/u/${slot}/feed/atom?t=` + Date.now(), {
    credentials: 'include',
  })
  const text = await resp.text()
  await debugLog('getRSS: response ->', {
    slot,
    status: resp.status,
    ok: resp.ok,
    contentType: resp.headers.get('content-type'),
    redirected: resp.redirected,
    url: resp.url,
    bodyPreview: text.slice(0, 300),
  })
  // An out-of-range slot doesn't 404 or bounce to the login page - confirmed
  // live, Gmail 302s it straight to u/0's feed (and a fully signed-out
  // session 302s to accounts.google.com). Either way resp.url no longer
  // carries the slot we asked for, which is the only reliable tell.
  if (!resp.ok || parseAccountSlot(resp.url) !== slot) {
    return null
  }
  const rss = extractRSS(text)
  return {
    ...rss,
    // Rewrite each entry's slot to the one that actually served this feed.
    // Confirmed live: the feed's entry links hardcode /u/0 no matter which
    // slot was fetched, and everything downstream - thread detail fetches,
    // archive/read/delete actions (their at/ik tokens), open-in-web links -
    // derives its slot from the thread URL. Without this rewrite, every
    // action on a non-default account would run against account 0.
    feeds: rss.feeds.map((feed) => ({
      ...feed,
      url: feed.url.replace(/\/u\/\d+/, `/u/${slot}`),
    })),
  }
}

export async function getRSS(): Promise<RSSInfo> {
  let slot = await detectActiveSlot()
  let rss: RSSInfo | null
  try {
    rss = await fetchFeedForSlot(slot)
  } catch (err) {
    console.error('getRSS failed', err)
    throw err
  }
  // The preferred slot can go stale (that account signed out, slots
  // reshuffled). Slot 0 is the only meaningful blind fallback: Gmail
  // guarantees the default account occupies it whenever anyone is signed in
  // at all, so anything beyond 0 can only ever be reached via a real signal
  // (tab URL / sync ping), never by scanning.
  if (!rss && slot !== '0') {
    slot = '0'
    rss = await fetchFeedForSlot(slot)
  }
  if (!rss) {
    throw new Error('getRSS: no signed-in Gmail account responded')
  }
  await rememberActiveSlot(slot)
  return rss
}

interface Attachment {
  fileName: string
  url: string
  size?: number
}

interface Message {
  senderName: string // Sender name
  senderEmail: string // Sender email
  time: string // Send time
  to: string[] // Recipients
  cc: string[] // CC recipients
  replyTo?: string // Reply-to address
  contentHtml: string // Email body (HTML)
  contentText?: string // Email body (plain text, optional)
  attachments?: Attachment[] // Attachments (if any)
}

export interface ThreadMail {
  subject: string
  messageCount: number
  messages: Message[]
  // CSS extracted from <style> tags in the fetched document, applied to each message's shadow root
  styles: string[]
}

// Tue, Jun 3, 2025 at 10:12 AM => 2025-06-03T10:12:00.000Z
export function formatDate(date: string): string {
  const cleaned = date.replace(/^\w+,\s*/, '')
  return dayjs(cleaned, 'MMM D, YYYY [at] h:mm A').toISOString()
}

export function parseAddressField(html: string): string[] {
  const result: string[] = []
  const decoded = decodeHTML(html)
  // Match all "name" <email> or email only. The leading `,?\s*` and excluding
  // `,`/`"` from the name keeps the ", " separator before the next recipient
  // from being swallowed into that recipient's name.
  const regex = /,?\s*"?([^",<]*?)"?\s*<([^>]+)>/g
  let match
  while ((match = regex.exec(decoded))) {
    if (match[1]) {
      const name = match[1].trim()
      const email = match[2]!.trim()
      if (name === email) {
        result.push(email)
      } else {
        result.push(`${name} <${email}>`)
      }
    } else {
      const email = match[2]!.trim()
      result.push(email)
    }
  }
  // If no match found, try to match email directly
  if (result.length === 0) {
    const emailRegex = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g
    const emails = decoded.match(emailRegex)
    if (emails) result.push(...emails)
  }
  return result
}

export function extractThreadMail(text: string, baseUrl?: string): ThreadMail {
  const doc = parse(text)
  // 1. Subject
  let subject =
    getTextContent(querySelector('title', doc))?.trim() ||
    getTextContent(querySelector('.maincontent font[size="+1"] b', doc))?.trim() ||
    ''
  if (subject.startsWith('Gmail - ')) {
    subject = subject.replace('Gmail - ', '')
  }

  // 2. Message count
  const messageCountText = getTextContent(querySelector('.maincontent font[color="#777"]', doc)) || ''
  const messageCountMatch = messageCountText.match(/(\d+) messages?/)
  const messageCount = messageCountMatch ? parseInt(messageCountMatch[1]!, 10) : 0

  // 3. CSS extracted from any <style> tags present in the document
  const styles = querySelectorAll('style', doc)
    .map((style) => getTextContent(style)?.trim() || '')
    .filter(Boolean)

  // 4. Each email
  const messageTables = querySelectorAll('table.message', doc)
  const messages: Message[] = []
  messageTables.forEach((table) => {
    // Sender
    const senderInfo = getTextContent(querySelector('b', table))?.trim() || ''
    const senderEmailMatch = getInnerHTML(table)?.match(/<b>.*?<\/b>\s*&lt;([^&]+)&gt;/)
    const senderEmail = senderEmailMatch ? senderEmailMatch[1]!.trim() : ''
    // Time
    let time = getTextContent(querySelector('td[align="right"] font[size="-1"]', table)) || ''
    if (time) {
      time = formatDate(time)
    }
    // Recipients/CC/Reply-to
    const to: string[] = []
    const cc: string[] = []
    let replyTo: string | undefined = undefined
    querySelectorAll('.recipient div', table).forEach((div) => {
      const html = getInnerHTML(div) || ''
      if (html.startsWith('To:')) {
        to.push(...parseAddressField(html.replace('To:', '').trim()))
      } else if (html.startsWith('Cc:')) {
        cc.push(...parseAddressField(html.replace('Cc:', '').trim()))
      } else if (html.startsWith('Reply-To:')) {
        replyTo = decodeHTML(html.replace('Reply-To:', '').trim())
      }
    })
    // Body
    const contentDiv = querySelector('div[style*="overflow: hidden"]', table)

    // Attachments (simple implementation: find all a[href] and img[src])
    const attachments: Attachment[] = []
    if (contentDiv) {
      querySelectorAll('a[href]', contentDiv).forEach((a) => {
        const url = getAttribute(a, 'href')
        const fileName = getTextContent(a) || url || ''
        if (url?.match(/\.(pdf|docx?|xlsx?|zip|rar|7z|png|jpg|jpeg|gif|md|txt)(\?|$)/i)) {
          attachments.push({ fileName, url })
        }
      })
      const images = [...querySelectorAll('img[src]', contentDiv)]
      images.forEach((img) => {
        if (getAttribute(img, 'height') === '1' && getAttribute(img, 'width') === '1') {
          return
        }
        if (getAttribute(img, 'src')?.startsWith('http')) {
          return
        }
        // replace image src with baseUrl
        if (baseUrl) {
          setAttribute(img, 'src', baseUrl + getAttribute(img, 'src'))
        }
        // set container overflow
        const container = getParentElement(img)
        if (container) {
          setAttribute(container, 'style', getAttribute(container, 'style') + '; overflow-x: auto;')
        }
      })
    }
    const contentHtml = getInnerHTML(contentDiv)?.trim() || ''
    const contentText = getTextContent(contentDiv)?.trim() || ''
    const msg: Message = {
      senderName: senderInfo,
      senderEmail,
      time,
      to,
      cc,
      replyTo,
      contentHtml,
      contentText,
    }
    if (attachments.length) {
      msg.attachments = attachments
    }
    messages.push(msg)
  })
  return {
    subject,
    messageCount,
    messages,
    styles,
  }
}

// https://mail.google.com/mail/u/0/?ui=2&view=pt&search=all&th=19735160ecf4ec0f
export async function getThreadMail(url: string) {
  const u = new URL(url)
  const baseUrl = u.origin + u.pathname
  const messageId = u.searchParams.get('message_id')
  const resp = await fetch(`${baseUrl}/?ui=2&view=pt&search=all&th=${messageId}`, { credentials: 'include' })
  const text = await resp.text()
  return extractThreadMail(text, baseUrl)
}

// Safari doesn't search across cookie stores by default the way Chrome/Firefox
// do - a plain cookies.get() silently misses the cookie unless storeId is
// given explicitly, so fall back to checking every store when the direct
// lookup comes up empty.
async function getCookie(name: string, url: string): Promise<string | undefined> {
  const cookie = await browser.cookies.get({ url, name })
  if (cookie) {
    return cookie.value
  }
  const stores = await browser.cookies.getAllCookieStores()
  for (const store of stores) {
    const storeCookie = await browser.cookies.get({ url, name, storeId: store.id })
    if (storeCookie) {
      return storeCookie.value
    }
  }
  return undefined
}

export async function getGmailAt(n: string) {
  return getCookie('GMAIL_AT', `https://mail.google.com/mail/u/${n}`)
}

// "Logged in" means any signed-in account, not specifically slot 0's -
// GMAIL_AT is path-scoped per slot (/mail/u/{n}), so probe each. Slots are
// assigned contiguously but sign-outs can leave gaps in the cookies, so scan
// a fixed small range rather than stopping at the first miss.
const MAX_ACCOUNT_SLOTS = 10
export async function checkLoginStatus() {
  for (let i = 0; i < MAX_ACCOUNT_SLOTS; i++) {
    if (await getGmailAt(String(i))) {
      return true
    }
  }
  return false
}

export function extractGmailInfo(url: string) {
  // For example: https://mail.google.com/mail/u/0?account_id=xxx&message_id=xxxx&view=conv&extsrc=atom
  const m = url.match(/u\/(?<n>\d+).*message_id=(?<thread>[^&]+)/)
  if (m && m.groups) {
    return { n: m.groups.n!, thread: m.groups.thread! }
  }
  // Compatible with u=0 format
  const n = url.match(/u[=\/](\d+)/)?.[1] || '0'
  const thread = url.match(/message_id=([^&]+)/)?.[1]
  if (n && thread) return { n, thread }
  return null
}

// IK/AT cache
const ikCache = new Map<string, string>()
const atCache = new Lru<string>(100, 0) // disable at cache

export async function getIk(n: string): Promise<string | null> {
  if (ikCache.has(n)) {
    return ikCache.get(n)!
  }
  const page =
    (await browser.storage.local.get<Record<string, string>>('page-' + n))['page-' + n] ||
    `https://mail.google.com/mail/u/${n}/s/`
  async function next(href: string): Promise<string | null> {
    const r = await fetch(href, { credentials: 'include' })
    if (r.ok) {
      const content = await r.text()
      const m = content.match(/ID_KEY\s*=\s*['"](?<ik>[^'"]*)['"]/)
      if (m && m.groups && m.groups.ik) {
        ikCache.set(n, m.groups.ik)
        return m.groups.ik
      }
      const doc = parse(content)
      const meta = querySelector('meta[http-equiv="refresh"]', doc)
      if (meta) {
        const url = getAttribute(meta, 'content')?.split('url=')[1]
        if (url) {
          const o = new URL(url, page)
          await browser.storage.local.set({ ['page-' + n]: o.href })
          return next(o.href)
        }
      }
    }
    throw Error('core.js -> id_key')
  }
  return next(page)
}

export async function getAt(n: string): Promise<string | null> {
  let at = atCache.get(n)
  // disable at cache for now
  if (at) {
    return at
  }
  at = await getGmailAt(n)
  if (at) {
    atCache.set(n, at)
    return at
  }

  // fallback
  const resp = await fetch(`https://mail.google.com/mail/u/${n}/h/`, {
    credentials: 'include',
  })
  if (!resp.ok) {
    throw Error('core.js -> at -> ' + resp.status)
  }
  const content = await resp.text()
  const doc = parse(content)
  const e = querySelector('a[href*="at="]', doc)
  const input = querySelector('[name="at"]', doc)
  if (e) {
    const args = new URLSearchParams(getAttribute(e, 'href')?.split('?')[1])
    if (args.has('at')) {
      atCache.set(n, args.get('at')!)
      return args.get('at')
    }
  }
  if (input && getAttribute(input, 'value') && getAttribute(input, 'value') !== 'null') {
    atCache.set(n, getAttribute(input, 'value')!)
    return getAttribute(input, 'value')!
  }
  throw Error('core.js -> at (h); Try to open Gmail in a browser tab to set the cookie')
}

// Email operation related
async function gmailAction({ url, cmd, prefs = {} }: { url: string; cmd: string; prefs?: Record<string, any> }) {
  const info = extractGmailInfo(url)
  if (!info) throw Error('no_links')
  const { n, thread } = info
  const at = await getAt(n)
  if (!at) throw Error('getAt failed')
  const ik = await getIk(n)
  if (!ik) throw Error('getIk failed')

  const action: any = {
    command: 'l:all',
    labels: [],
    ids: [],
  }
  if (cmd === 'rd') {
    // mark as read
    action.code = 3
  } else if (cmd === 'ur') {
    // mark as unread
    action.code = 2
  } else if (cmd === 'rc_^i' || cmd === 'rc_Inbox') {
    // archive
    action.code = 1
    if (prefs.doReadOnArchive) {
      await gmailAction({ url, cmd: 'rd', prefs })
    }
  } else if (cmd === 'sp' || cmd === 'rc_Spam') {
    // report spam
    action.code = 7
  } else if (cmd === 'tr') {
    // trash
    action.code = 9
  } else if (cmd === 'st') {
    // star
    action.code = 5
  } else if (cmd === 'xst') {
    // remove star
    action.code = 6
  }
  if (!action.code) throw Error('action_not_supported: ' + cmd)

  const body = new FormData()
  body.append(
    's_jr',
    JSON.stringify([
      null,
      [
        [null, null, null, [null, action.code, thread, thread, action.command, [], action.labels, action.ids]],
        [null, null, null, null, null, null, [null, true, false]],
        [null, null, null, null, null, null, [null, true, false]],
      ],
      2,
      null,
      null,
      null,
      ik,
    ]),
  )

  const href = `https://mail.google.com/mail/u/${n}/s/?v=or&ik=${ik}&at=${at}&subui=chrome&hl=en&ts=` + Date.now()
  return fetch(href, {
    method: 'POST',
    credentials: 'include',
    body,
  })
}

export async function archiveMail(url: string, prefs?: Record<string, any>) {
  return gmailAction({ url, cmd: 'rc_^i', prefs })
}

export async function markAsRead(url: string) {
  await gmailAction({ url, cmd: 'rd' })
}

export async function markAsUnread(url: string) {
  return gmailAction({ url, cmd: 'ur' })
}

export async function markAsSpam(url: string) {
  return gmailAction({ url, cmd: 'sp' })
}

export async function deleteMail(url: string) {
  return gmailAction({ url, cmd: 'tr' })
}

export async function starMail(url: string) {
  return gmailAction({ url, cmd: 'st' })
}

export async function unstarMail(url: string) {
  return gmailAction({ url, cmd: 'xst' })
}

export async function markAllAsRead(urls: string[]) {
  return Promise.all(urls.map((url) => markAsRead(url)))
}

export function getOpenWebLink(url: string) {
  const u = new URL(url)
  const messageId = u.searchParams.get('message_id')
  if (!messageId) {
    return url
  }
  const baseUrl = u.origin + u.pathname
  return `${baseUrl}/#inbox/${messageId}`
}

export async function openMailInWeb(url: string) {
  const openWebLink = getOpenWebLink(url)
  const tabs = await browser.tabs.query({ url: 'https://mail.google.com/*' })
  // Prefer a tab already on the same account slot - reusing whichever Gmail
  // tab happens to be first would hijack a different account's tab when
  // several are signed in. No same-slot tab -> a fresh one, not a takeover.
  const slot = parseAccountSlot(openWebLink)
  const target = slot === null ? tabs[0] : tabs.find((tab) => tab.url && parseAccountSlot(tab.url) === slot)
  if (!target) {
    await browser.tabs.create({ url: openWebLink })
    return
  }
  await browser.tabs.update(target.id!, { url: openWebLink, active: true })
  await browser.windows.update(target.windowId!, { focused: true })
}

// The inbox of whichever account the extension is currently showing - i.e.
// the slot getRSS last fetched successfully.
export async function getActiveInboxUrl() {
  return `https://mail.google.com/mail/u/${await getStoredActiveSlot()}/#inbox`
}

export async function newEmail() {
  const currentWindow = await browser.windows.getCurrent()
  const windowWidth = 800
  const windowHeight = 600
  let top = 0
  if (currentWindow.height) {
    top = Math.floor((currentWindow.height - windowHeight) / 2)
  }
  let left = 0
  if (currentWindow.width) {
    left = Math.floor((currentWindow.width - windowWidth) / 2)
  }

  await browser.windows.create({
    url: `https://mail.google.com/mail/u/${await getStoredActiveSlot()}/?fs=1&tf=cm`,
    type: 'popup',
    width: windowWidth,
    height: windowHeight,
    left,
    top,
    focused: true,
  })
}

export function parseReplyTo(
  thread: ThreadMail,
  me: string,
):
  | {
      email: string
      name?: string
    }
  | undefined {
  const to = thread.messages.find((it) => it.senderEmail !== me)
  if (!to) {
    return
  }
  return {
    email: to.senderEmail,
    name: to.senderName,
  }
}

function getMessageMetadata(messageId: string) {
  // https://mail.google.com/mail/u/0/?ui=2&ik=${ik}&view=om&th=${threadId}
  throw new Error('not implemented')
}

async function getThreadId(messageId: string, ik: string) {
  // https://mail.google.com/mail/u/0/?ui=2&ik=ff42d05bcd&start=0&num=20&mb=0&rt=c&search=all&q=rfc822msgid:1987838ba0828a8b
  const params = new URLSearchParams({
    ui: '2',
    ik: ik,
    view: 'tl',
    start: '0',
    num: '20',
    mb: '0',
    rt: 'c',
    search: 'all',
    q: `rfc822msgid:${messageId}`,
  })

  const response = await fetch(`https://mail.google.com/mail/u/0/?${params}`, {
    credentials: 'include',
    headers: {
      Accept: '*/*',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })
  if (!response.ok) {
    throw response
  }
  const text = await response.text()
  throw new Error('not implemented')
}
