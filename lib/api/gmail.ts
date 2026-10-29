import { last } from 'es-toolkit'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
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
import { liftBackgroundImages } from '../emailBackground'

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

async function getStoredActiveSlot(): Promise<string> {
  const { [ACTIVE_SLOT_KEY]: slot } = await browser.storage.local.get<{ [ACTIVE_SLOT_KEY]?: string }>(ACTIVE_SLOT_KEY)
  return slot ?? '0'
}

// Called on every Gmail sync ping (several a second), so only write when the
// slot actually changed.
export async function rememberActiveSlot(slot: string): Promise<void> {
  if ((await getStoredActiveSlot()) !== slot) {
    await browser.storage.local.set({ [ACTIVE_SLOT_KEY]: slot })
  }
}

// Which account do "open Gmail" and "compose" go to? In order:
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
  await debugLog('fetchFeedForSlot: response ->', {
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
  //
  // Only that redirect means "no account here". An HTTP error has to throw
  // instead: getAllRSS cuts the account list at the first null, so a single
  // transient 5xx would otherwise look like a sign-out - dropping that
  // account's threads and re-notifying all of them on the next good poll.
  if (!resp.ok) {
    throw new Error(`fetchFeedForSlot: u/${slot} feed -> ${resp.status}`)
  }
  if (parseAccountSlot(resp.url) !== slot) {
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

const ACCOUNT_COUNT_KEY = 'accountCount'

// Every signed-in account's feed, in slot order. Slots are contiguous from 0
// and an out-of-range one is detectable (fetchFeedForSlot returns null), so
// fetch the slots seen last time plus one more in parallel and cut at the
// first miss: a steady-state poll costs one request per account plus a
// single probe, and a newly signed-in account shows up on the next poll.
export async function getAllRSS(): Promise<RSSInfo[]> {
  const { [ACCOUNT_COUNT_KEY]: known = 1 } = await browser.storage.local.get<{ [ACCOUNT_COUNT_KEY]?: number }>(
    ACCOUNT_COUNT_KEY,
  )
  const slots = Array.from({ length: Math.min(known + 1, MAX_ACCOUNT_SLOTS) }, (_, i) => String(i))
  // Promise.all, not allSettled: any slot failing aborts the whole poll and
  // leaves the previous state untouched, rather than treating it as gone.
  const results = await Promise.all(slots.map(fetchFeedForSlot))
  const firstMiss = results.indexOf(null)
  const accounts = (firstMiss === -1 ? results : results.slice(0, firstMiss)) as RSSInfo[]
  if (accounts.length === 0) {
    throw new Error('getAllRSS: no signed-in Gmail account responded')
  }
  if (accounts.length !== known) {
    await browser.storage.local.set({ [ACCOUNT_COUNT_KEY]: accounts.length })
  }
  return accounts
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

// Bumped whenever extractThreadMail's output changes in a way that makes
// already-extracted HTML wrong: contentHtml is not just a copy of the source,
// it carries decisions made at extraction time - the dark-mode
// background-image marker - so HTML produced by another version can render
// wrong even though the mail itself is unchanged (the old per-image custom
// properties and message-global board marker are read by nobody now).
//
// The value is stamped onto every ThreadMail and compared in
// StateManager.fetchThreads, which refuses to keep a thread carrying another
// version. That comparison is the invariant, not the refresh path: threads are
// not hydrated from storage, so a service worker restart (every extension
// update) starts with an empty list and re-fetches the whole feed anyway, and
// the persisted cache is refreshed by that fetch. See the comment at the check
// for what it does and does not cover.
//
// Version 1: background-image blocks are marked whole (data-email-bg) and
// rendered as-is, text included; the per-image custom properties and the
// message-global board marker are gone, so HTML extracted by the version that
// wrote them no longer matches what the dark-mode stylesheet expects and has
// to be re-extracted.
export const CURRENT_EXTRACT_VERSION = 1

export interface ThreadMail {
  subject: string
  messageCount: number
  messages: Message[]
  // CSS extracted from <style> tags in the fetched document, applied to each message's shadow root
  styles: string[]
  // Which extractThreadMail produced this, see CURRENT_EXTRACT_VERSION.
  extractVersion: number
}

const DATE_FORMATS = ['MMM D, YYYY h:mm A', 'MMM D, YYYY H:mm', 'D MMM YYYY h:mm A', 'D MMM YYYY H:mm']

// Tue, Jun 3, 2025 at 10:12 AM => 2025-06-03T10:12:00.000Z
// The print view's date text varies (", " or " at " before the time, 12h or
// 24h, narrow no-break space before AM/PM, day-first). An unknown format
// returns '' - a missing time beats dropping every account's mail.
const loggedDateFormats = new Set<string>()
export function formatDate(date: string): string {
  const cleaned = date
    .replace(/[\u00a0\u202f]/g, ' ')
    .replace(/^\w+,\s*/, '')
    .replace(/(\d{4}),?\s+(?:at\s+)?/, '$1 ')
  const parsed = dayjs(cleaned, DATE_FORMATS, true)
  if (!parsed.isValid()) {
    if (!loggedDateFormats.has(date)) {
      loggedDateFormats.add(date)
      void debugLog('formatDate: unknown date format ->', JSON.stringify(date))
    }
    return ''
  }
  return parsed.toISOString()
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
      // Background images are painted by the element itself, so the only way
      // the dark-mode filter can reach them is to mark the element and render
      // it whole - see liftBackgroundImages.
      liftBackgroundImages(contentDiv)

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
    extractVersion: CURRENT_EXTRACT_VERSION,
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
  // Read fresh every time, never cached: Gmail rotates GMAIL_AT, and a stale
  // one makes every action silently do nothing.
  const at = await getGmailAt(n)
  if (at) {
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
      return args.get('at')
    }
  }
  if (input && getAttribute(input, 'value') && getAttribute(input, 'value') !== 'null') {
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
  const resp = await fetch(href, {
    method: 'POST',
    credentials: 'include',
    body,
  })
  // A rejected action must surface, or the mail vanishes from the list and
  // silently comes back on the next poll.
  const text = await resp.text()
  await debugLog('gmailAction: response ->', { cmd, slot: n, status: resp.status, bodyPreview: text.slice(0, 200) })
  if (!resp.ok) {
    throw new Error(`gmailAction ${cmd}: ${resp.status}`)
  }
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

// The inbox of whichever account the user is currently using in Gmail.
export async function getActiveInboxUrl() {
  return `https://mail.google.com/mail/u/${await detectActiveSlot()}/#inbox`
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
    url: `https://mail.google.com/mail/u/${await detectActiveSlot()}/?fs=1&tf=cm`,
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

// The message's full RFC 822 source - Gmail's "Show original" - which is
// the only place headers such as List-Unsubscribe are visible.
export async function getRawMessage(url: string): Promise<string> {
  const info = extractGmailInfo(url)
  if (!info) throw Error('no_links')
  const ik = await getIk(info.n)
  if (!ik) throw Error('getRawMessage: no ik')
  const resp = await fetch(
    `https://mail.google.com/mail/u/${info.n}/?ui=2&ik=${ik}&view=om&th=${info.thread}`,
    { credentials: 'include' },
  )
  if (!resp.ok) {
    throw new Error(`getRawMessage: ${resp.status}`)
  }
  return extractRawSource(await resp.text())
}

// "Show original" is an HTML page; the source sits HTML-escaped in a <pre>.
export function extractRawSource(page: string): string {
  const pre = page.match(/<pre[^>]*id="raw_message_text"[^>]*>([\s\S]*?)<\/pre>/)
  return pre ? decodeHTML(pre[1]!) : page
}
