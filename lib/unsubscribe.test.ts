import { describe, expect, it } from 'vitest'
import { findUnsubscribeLink, hasUnsubscribeLink, planUnsubscribe } from './unsubscribe'

const ONE_CLICK_RAW = [
  'Delivered-To: me@gmail.com',
  'Subject: Weekly digest',
  'List-Unsubscribe: <mailto:leave-123@lists.example.com?subject=unsubscribe>,',
  ' <https://example.com/unsub?u=123>',
  'List-Unsubscribe-Post: List-Unsubscribe=One-Click',
  'Content-Type: text/html',
  '',
  '<html>List-Unsubscribe: <https://evil.example/body-is-not-a-header></html>',
].join('\r\n')

describe('planUnsubscribe', () => {
  it('prefers RFC 8058 one-click, across folded header lines', () => {
    expect(planUnsubscribe(ONE_CLICK_RAW, '')).toEqual({ kind: 'post', url: 'https://example.com/unsub?u=123' })
  })

  it('opens the header link when the sender does not support one-click', () => {
    const raw = 'Subject: x\nList-Unsubscribe: <https://example.com/unsub?u=1>\n\nbody'
    expect(planUnsubscribe(raw, '')).toEqual({ kind: 'open', url: 'https://example.com/unsub?u=1' })
  })

  it('falls back to a mailto unsubscribe', () => {
    const raw = 'List-Unsubscribe: <mailto:leave@example.com?subject=Unsubscribe%20me>\n\nbody'
    expect(planUnsubscribe(raw, '')).toEqual({ kind: 'mail', to: 'leave@example.com', subject: 'Unsubscribe me' })
  })

  it("falls back to the body's unsubscribe link when headers are missing or unreadable", () => {
    const html = '<p>Hi</p><a href="https://shop.example/account/emails?t=9">Unsubscribe</a>'
    expect(planUnsubscribe(null, html)).toEqual({ kind: 'open', url: 'https://shop.example/account/emails?t=9' })
    expect(planUnsubscribe('Subject: x\n\nbody', html)).toEqual({
      kind: 'open',
      url: 'https://shop.example/account/emails?t=9',
    })
  })

  it('gives up when there is nothing to unsubscribe from', () => {
    expect(planUnsubscribe('Subject: hi\n\nbody', '<p>Lunch tomorrow?</p>')).toBeNull()
  })
})

describe('findUnsubscribeLink', () => {
  it.each([
    ['<a href="https://a.example/x">Unsubscribe</a>', 'https://a.example/x'],
    ['<a href="https://a.example/x">Newsletter abbestellen</a>', 'https://a.example/x'],
    ['<a href="https://a.example/x">Se désabonner</a>', 'https://a.example/x'],
    ['<a href="https://a.example/x">click here</a> to unsubscribe', null],
    ['<a href="https://a.example/unsubscribe?id=1">click here</a>', 'https://a.example/unsubscribe?id=1'],
    ['<a href="https://a.example/x">Unsubscribe</a>'.replace('https', 'javascript'), null],
  ])('%s -> %s', (html, url) => {
    expect(findUnsubscribeLink(html)).toBe(url)
  })

  it('prefers a link whose text says unsubscribe over one whose url does', () => {
    const html =
      '<a href="https://a.example/track/unsub-pixel">view</a><a href="https://a.example/real">Unsubscribe</a>'
    expect(findUnsubscribeLink(html)).toBe('https://a.example/real')
  })
})

describe('hasUnsubscribeLink', () => {
  it('is a cheap pre-check for the popup button', () => {
    expect(hasUnsubscribeLink('<a href="https://a.example/x">Unsubscribe</a>')).toBe(true)
    expect(hasUnsubscribeLink('<p>Lunch tomorrow?</p>')).toBe(false)
  })
})
