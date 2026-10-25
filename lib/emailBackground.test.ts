import { describe, expect, it } from 'vitest'
import { parse } from 'parse5'
import { getAttribute, getInnerHTML, querySelector, querySelectorAll } from './domutils'
import {
  EMAIL_BG_ATTR,
  EMAIL_BOARD_ATTR,
  hasBoardImage,
  liftBackgroundImages,
  splitDeclarations,
} from './emailBackground'

// Lifts every background image in `html` and returns the serialized result,
// which is what the dark-mode stylesheet ends up seeing.
function lifted(html: string): string {
  const doc = parse(html)
  liftBackgroundImages(doc)
  return getInnerHTML(doc)!
}

// Renders markup off-screen so real layout can be measured in the browser.
function renderOffscreen(html: string): HTMLElement {
  const root = document.createElement('div')
  root.style.cssText = 'position: absolute; left: -10000px; top: 0; width: 800px'
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

function geometry(root: HTMLElement): string[] {
  return [...root.querySelectorAll('*')].map((el) => {
    const rect = el.getBoundingClientRect()
    return `${el.tagName} ${rect.x},${rect.y},${rect.width},${rect.height}`
  })
}

const PINTEREST_TILE = `
  <table border="0" cellpadding="0" cellspacing="0" style="table-layout:fixed;font-size:0;border-collapse:collapse" width="241">
    <tbody>
      <tr>
        <td align="center" background="https://i.pinimg.com/400x300/cover.jpg" style="border-radius:16px 0 0 16px;background-size:cover;background-position:center;background-repeat:no-repeat">
          <a href="#"><div style="border-radius:16px 0 0 16px"><div style="display:block;height:241px;width:241px;opacity:0.97"> </div></div></a>
        </td>
        <td>
          <a href="#"><div style="background-color:#111111;border-radius:0 16px 0 0"><img border="0" height="120" src="https://i.pinimg.com/150x150/pin1.jpg" style="display:block;width:120px;height:120px;border-radius:0 16px 0 0;border:0;background-color:#efefef;opacity:0.97" width="120"></div></a>
        </td>
      </tr>
    </tbody>
  </table>
`

describe('liftBackgroundImages', () => {
  it('re-declares a legacy background attribute as a custom property', () => {
    const html = lifted('<table><tr><td background="https://i.pinimg.com/cover.jpg" style="background-size:cover">cell</td></tr></table>')
    const td = querySelector('td', parse(html))!
    expect(getAttribute(td, EMAIL_BG_ATTR)).eq('image')
    expect(getAttribute(td, 'style')).includes('--email-bg-image: url("https://i.pinimg.com/cover.jpg")')
    // The original declaration stays put: light mode must render as it always did.
    expect(getAttribute(td, 'background')).eq('https://i.pinimg.com/cover.jpg')
  })

  it('quotes a bare url and leaves an already-CSS url alone', () => {
    const bare = parse(lifted('<table><tr><td background="https://i.pinimg.com/a.jpg"></td></tr></table>'))
    expect(getAttribute(querySelector('td', bare), 'style')).includes('url("https://i.pinimg.com/a.jpg")')

    const wrapped = parse(lifted('<table><tr><td background="url(https://i.pinimg.com/a.jpg)"></td></tr></table>'))
    expect(getAttribute(querySelector('td', wrapped), 'style')).includes('--email-bg-image: url(https://i.pinimg.com/a.jpg)')
  })

  it('copies the positioning longhands of an inline background-image', () => {
    const html = lifted(
      '<div style="color: #fff; background-image: url(https://i.pinimg.com/hero.jpg); background-size: contain; background-position: left top; background-repeat: no-repeat">hero</div>',
    )
    const div = querySelector('div', parse(html))!
    const style = getAttribute(div, 'style')!
    expect(getAttribute(div, EMAIL_BG_ATTR)).eq('image')
    expect(style).includes('--email-bg-image: url(https://i.pinimg.com/hero.jpg)')
    expect(style).includes('--email-bg-size: contain')
    expect(style).includes('--email-bg-position: left top')
    expect(style).includes('--email-bg-repeat: no-repeat')
    // Untouched declarations survive the rewrite.
    expect(style).includes('color: #fff')
  })

  it('hands a whole shorthand to the layer instead of re-parsing it', () => {
    const html = lifted('<div style="background: #111111 url(&quot;https://i.pinimg.com/b.jpg&quot;) no-repeat center/cover; color: #fff">banner</div>')
    const div = querySelector('div', parse(html))!
    expect(getAttribute(div, EMAIL_BG_ATTR)).eq('shorthand')
    expect(getAttribute(div, 'style')).includes('--email-bg-shorthand: #111111 url("https://i.pinimg.com/b.jpg") no-repeat center/cover')
  })

  it('prefers an inline background-image over the background attribute', () => {
    const html = lifted('<table><tr><td background="https://i.pinimg.com/attr.jpg" style="background-image: url(https://i.pinimg.com/inline.jpg)"></td></tr></table>')
    expect(getAttribute(querySelector('td', parse(html)), 'style')).includes('--email-bg-image: url(https://i.pinimg.com/inline.jpg)')
  })

  it('ignores elements without a background image', () => {
    const source = '<div style="background-color: #fff; color: red">plain</div><img src="https://i.pinimg.com/a.jpg">'
    const html = lifted(source)
    expect(querySelectorAll(`[${EMAIL_BG_ATTR}]`, parse(html))).length(0)
    expect(html).includes('style="background-color: #fff; color: red"')
  })

  it('does not split declarations inside url()/quotes', () => {
    expect(splitDeclarations('background-image: url("data:image/svg+xml;base64,AAA;BBB"); color: red')).toEqual([
      { prop: 'background-image', value: 'url("data:image/svg+xml;base64,AAA;BBB")' },
      { prop: 'color', value: 'red' },
    ])
  })

  it('keeps every declaration when a data URI holds semicolons', () => {
    const html = lifted('<div style="color: red; background-image: url(&quot;data:image/svg+xml;base64,AAA;BBB&quot;); background-size: cover">x</div>')
    const style = getAttribute(querySelector('div', parse(html)), 'style')!
    expect(style).includes('color: red')
    expect(style).includes('--email-bg-size: cover')
  })

  it('counts every lifted element', () => {
    const doc = parse('<table><tr><td background="https://i.pinimg.com/a.jpg"></td></tr></table><div style="background-image:url(b.jpg)"></div><span>x</span>')
    expect(liftBackgroundImages(doc)).eq(2)
  })

  // A board is a background image that *is* the layout, with the copy on top of
  // it - as opposed to a tile/button that happens to be painted with an image.
  // The dark-mode stylesheet has to treat the first kind as "hands off", and
  // this attribute is what carries that decision from here (where the DOM is)
  // to the popup (which only gets a string of HTML).
  describe('design boards', () => {
    const COPY = '尊敬的客户，截至昨日最后一笔交易，您的额度和积分信息如下：'

    it('marks a background image that carries the message copy', () => {
      const html = lifted(`<table background="https://ci3.googleusercontent.com/board.png"><tr><td>${COPY}</td></tr></table>`)
      const table = querySelector('table', parse(html))!
      expect(getAttribute(table, EMAIL_BOARD_ATTR)).eq('')
      expect(hasBoardImage(html)).toBe(true)
    })

    it('counts copy nested several tables deep', () => {
      const deep = `<table background="https://ci3.googleusercontent.com/board.png"><tr><td><table><tr><td><div><font>${COPY}</font></div></td></tr></table></td></tr></table>`
      expect(hasBoardImage(lifted(deep))).toBe(true)
    })

    it('ignores whitespace-only text, e.g. a spacer cell painted with an image', () => {
      const spacer = '<table background="https://i.pinimg.com/board.jpg"><tr><td><font>&nbsp;</font></td></tr></table>'
      expect(hasBoardImage(lifted(spacer))).toBe(false)
    })

    it('ignores a <style> block carrying CSS, however long', () => {
      // Emails do ship <style> inside the body. Its contents are source code,
      // not copy, and counting them would flag a mail as a board for nothing.
      const withStyle = `<table background="https://i.pinimg.com/tile.jpg"><tr><td><style>.a{font-family:arial,sans-serif;color:#333333;margin:0 auto}</style><font>&nbsp;</font></td></tr></table>`
      expect(hasBoardImage(lifted(withStyle))).toBe(false)
    })

    it('does not mistake a picture-only tile for a board', () => {
      const html = lifted(PINTEREST_TILE)
      expect(querySelectorAll(`[${EMAIL_BOARD_ATTR}]`, parse(html))).length(0)
      expect(hasBoardImage(html)).toBe(false)
    })

    it('does not mistake a background-image button for a board', () => {
      // 5 characters of label on a bg image: lifting it stays "compensate the
      // artwork", the message keeps its dark mode.
      const button = '<a href="#" style="background-image: url(https://i.pinimg.com/btn.png)">立即享权益</a>'
      const html = lifted(button)
      expect(getAttribute(querySelector('a', parse(html)), EMAIL_BG_ATTR)).eq('image')
      expect(hasBoardImage(html)).toBe(false)
    })

    it('does not mistake a long CTA label for a board', () => {
      // 13 characters - the longest CTA copy that is still clearly a button,
      // and the reason BOARD_TEXT_MIN does not go below this.
      const cta = '<a href="#" style="background-image: url(https://i.pinimg.com/btn.png)">点击领取 50 元还款金</a>'
      expect(hasBoardImage(lifted(cta))).toBe(false)
    })
  })

  describe('rendering', () => {
    it('leaves the light-mode layout byte-for-byte identical', () => {
      const before = renderOffscreen(PINTEREST_TILE)
      const after = renderOffscreen(lifted(PINTEREST_TILE))
      try {
        expect(geometry(after)).toEqual(geometry(before))
      } finally {
        before.remove()
        after.remove()
      }
    })

    it('keeps the original background-image in light mode', () => {
      // The `background-image: none` reset lives inside the dark-mode media
      // query only, so nothing repaints (or disappears) without it.
      const root = renderOffscreen(lifted(PINTEREST_TILE))
      try {
        const td = root.querySelector('td')!
        expect(getComputedStyle(td).backgroundImage).includes('i.pinimg.com/400x300/cover.jpg')
        expect(getComputedStyle(td).backgroundSize).eq('cover')
      } finally {
        root.remove()
      }
    })
  })
})
