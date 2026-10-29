import type { EmailThread } from './StateManager'

// Verification-code detection for one-time passwords sent by mail.
//
// A code is only ever reported next to an OTP keyword (within MAX_DISTANCE
// characters): numbers alone are everywhere in mail - order ids, prices,
// dates, phone numbers - and a wrong code is worse than none.

const KEYWORD =
  /code|c[oó]digo|codice|код|passcode|password|\bpin\b|\botp\b|one[- ]time|verif|best[aä]tig|einmal|anmeld|sicherheit|authenticat|\b2fa\b|two[- ]factor|token|sign[- ]?in|log[- ]?in|security|confirm|验证码|校验码|認証|確認コード|인증/gi
// Mentioned near a candidate, these mean a marketing code, not an OTP.
const PROMO = /promo|coupon|discount|voucher|gutschein|rabatt|gift ?card|% off/i
// 6 digits optionally split 3+3, 4-8 digits, or 5-8 uppercase letters and
// digits. An optional short letter prefix ("G-123456") is not part of what
// the user types.
const CANDIDATE = /(?:\b[A-Z]{1,3}-)?\b(\d{3}[ -]\d{3}|\d{4,8}|[A-Z0-9]{5,8})\b/g
const MAX_DISTANCE = 80
// Long HTML mails: the code is always near the top.
const MAX_TEXT = 5000

export function extractCode(...texts: (string | undefined)[]): string | null {
  const text = texts
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_TEXT)
    // Tokens inside links and addresses are never something to type.
    .replace(/https?:\/\/\S+|\S+@\S+/g, ' ')
  const keywords = [...text.matchAll(KEYWORD)].map((m) => [m.index, m.index + m[0].length] as const)
  if (keywords.length === 0) {
    return null
  }

  let best: { code: string; score: number } | null = null
  for (const m of text.matchAll(CANDIDATE)) {
    const raw = m[1]!
    const start = m.index + m[0].length - raw.length
    const end = m.index + m[0].length
    if (!/\d/.test(raw) || isPartOfLargerNumber(text, m.index, end)) {
      continue
    }
    const distance = Math.min(
      ...keywords.map(([ks, ke]) => (ke <= start ? start - ke : ks >= end ? ks - end : 0)),
    )
    if (distance > MAX_DISTANCE || PROMO.test(text.slice(Math.max(0, start - 40), end + 40))) {
      continue
    }
    const code = raw.replace(/[ -]/g, '')
    const digitsOnly = /^\d+$/.test(code)
    let score = -distance
    if (digitsOnly) score += 20
    if (code.length === 6) score += 10
    if (digitsOnly && code.length === 4 && /^(19|20)\d\d$/.test(code)) score -= 50
    if (!best || score > best.score) {
      best = { code, score }
    }
  }
  return best?.code ?? null
}

// The newest message is the one carrying a fresh code.
export function getThreadCode(thread: EmailThread): string | null {
  return extractCode(thread.title, thread.summary, thread.messages.at(-1)?.contentText)
}

// Prices, ids, dates, times, phone numbers: a digit run glued to more digits
// or to a currency/number sign is one piece of a bigger number.
function isPartOfLargerNumber(text: string, start: number, end: number): boolean {
  const before = text.slice(Math.max(0, start - 2), start)
  const after = text.slice(end, end + 2)
  return /[#$€£¥+]$|\d[ ./:,-]?$|[./:,-]\d$/.test(before) || /^[ ./:,-]?\d|^%/.test(after)
}
