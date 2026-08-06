import { describe, it, expect, vi } from 'vitest'
import { createStyleSheets } from './addStyle'

describe('createStyleSheets', () => {
  it('creates one CSSStyleSheet per valid style string', () => {
    const sheets = createStyleSheets(['body { color: red; }', '.logo { left: -7px; }'])
    expect(sheets).length(2)
    expect(sheets[0]).toBeInstanceOf(CSSStyleSheet)
    expect(sheets[0]!.cssRules[0]!.cssText).includes('color: red')
  })

  it('rewrites :root to :host so page-level rules apply inside the shadow root', () => {
    const [sheet] = createStyleSheets([':root { --foo: bar; }'])
    expect(sheet!.cssRules[0]!.cssText).includes(':host')
    expect(sheet!.cssRules[0]!.cssText).not.includes(':root')
  })

  it('skips a stylesheet whose replaceSync throws instead of crashing the caller', () => {
    // Real emails can carry CSS a given engine rejects outright (e.g. @import,
    // which constructable stylesheets disallow); one bad style block must not
    // take down every other message's styling.
    const spy = vi
      .spyOn(CSSStyleSheet.prototype, 'replaceSync')
      .mockImplementationOnce(() => {
        throw new DOMException('not allowed', 'NotAllowedError')
      })
    const sheets = createStyleSheets(['@import url(https://example.com/x.css);', 'body { color: blue; }'])
    spy.mockRestore()
    expect(sheets).length(1)
    expect(sheets[0]!.cssRules[0]!.cssText).includes('color: blue')
  })

  it('returns an empty array for an empty input', () => {
    expect(createStyleSheets([])).toEqual([])
  })
})
