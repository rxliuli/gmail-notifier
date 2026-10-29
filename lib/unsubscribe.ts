import { parse } from 'parse5'
import { getAttribute, getTextContent, querySelectorAll } from './domutils'

// How to unsubscribe from a mailing, best option first - the same signals
// Gmail's own unsubscribe button uses:
// - post: RFC 8058 one-click, a single background POST, nothing to confirm.
// - open: a page to visit (header or body link), usually with a confirm step.
// - mail: send a mail to the list's unsubscribe address.
export type UnsubscribePlan =
  | { kind: 'post'; url: string }
  | { kind: 'open'; url: string }
  | { kind: 'mail'; to: string; subject: string }

const UNSUBSCRIBE_TEXT =
  /unsub|abmelden|abbestellen|d[ée]sabonner|d[ée]sinscri|darse de baja|cancelar (la )?suscripci[oó]n|uitschrijven|disiscriv|opt[- ]out|退订|取消订阅|配信停止/i

// Cheap enough to run on every popup render; findUnsubscribeLink does the
// real parse only when the user clicks.
export function hasUnsubscribeLink(html: string): boolean {
  return UNSUBSCRIBE_TEXT.test(html)
}

// `raw` is the full RFC 822 source ("Show original"), null when it could not
// be fetched; `html` is the message body, the fallback for senders that put
// the link only in the footer.
export function planUnsubscribe(raw: string | null, html: string): UnsubscribePlan | null {
  const headers = raw ? parseHeaders(raw) : new Map<string, string>()
  const targets = [...(headers.get('list-unsubscribe') ?? '').matchAll(/<([^>]+)>/g)].map((m) => m[1]!.trim())
  const http = targets.find((it) => it.startsWith('https://') || it.startsWith('http://'))
  if (http && /List-Unsubscribe=One-Click/i.test(headers.get('list-unsubscribe-post') ?? '')) {
    return { kind: 'post', url: http }
  }
  if (http) {
    return { kind: 'open', url: http }
  }
  const mailto = targets.find((it) => it.startsWith('mailto:'))
  if (mailto) {
    const u = new URL(mailto)
    return { kind: 'mail', to: decodeURIComponent(u.pathname), subject: u.searchParams.get('subject') ?? 'Unsubscribe' }
  }
  const link = findUnsubscribeLink(html)
  return link ? { kind: 'open', url: link } : null
}

export function findUnsubscribeLink(html: string): string | null {
  const links = querySelectorAll('a[href]', parse(html))
    .map((a) => ({ href: getAttribute(a, 'href') ?? '', text: getTextContent(a) ?? '' }))
    .filter((it) => /^https?:\/\//i.test(it.href))
  return (
    links.find((it) => UNSUBSCRIBE_TEXT.test(it.text))?.href ??
    links.find((it) => UNSUBSCRIBE_TEXT.test(it.href))?.href ??
    null
  )
}

// Header block only (up to the first blank line), with folded continuation
// lines joined - List-Unsubscribe routinely spans several lines.
function parseHeaders(raw: string): Map<string, string> {
  const block = raw.split(/\r?\n\r?\n/, 1)[0]!.replace(/\r?\n[ \t]+/g, ' ')
  const headers = new Map<string, string>()
  for (const line of block.split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) {
      headers.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim())
    }
  }
  return headers
}
