import { describe, expect, it } from 'vitest'
import { parse } from 'parse5'
import { getAttribute, getInnerHTML, querySelector, querySelectorAll } from './domutils'
import { EMAIL_BG_ATTR, liftBackgroundImages } from './emailBackground'

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
  it('marks an element with a legacy background attribute', () => {
    const html = lifted('<table><tr><td background="https://i.pinimg.com/cover.jpg" style="background-size:cover">cell</td></tr></table>')
    const td = querySelector('td', parse(html))!
    expect(getAttribute(td, EMAIL_BG_ATTR)).toBe('')
    // Nothing but the marker is added: the attribute and the inline style stay
    // exactly as the sender wrote them, so light mode is untouched.
    expect(getAttribute(td, 'background')).toBe('https://i.pinimg.com/cover.jpg')
    expect(getAttribute(td, 'style')).toBe('background-size:cover')
  })

  it('marks an inline background-image', () => {
    const html = lifted(
      '<div style="color: #fff; background-image: url(https://i.pinimg.com/hero.jpg); background-size: contain">hero</div>',
    )
    const div = querySelector('div', parse(html))!
    expect(getAttribute(div, EMAIL_BG_ATTR)).toBe('')
    expect(getAttribute(div, 'style')).toBe(
      'color: #fff; background-image: url(https://i.pinimg.com/hero.jpg); background-size: contain',
    )
  })

  it('marks a background shorthand that carries an image', () => {
    const html = lifted(
      '<div style="background: #111111 url(&quot;https://i.pinimg.com/b.jpg&quot;) no-repeat center/cover; color: #fff">banner</div>',
    )
    const div = querySelector('div', parse(html))!
    expect(getAttribute(div, EMAIL_BG_ATTR)).toBe('')
    expect(getAttribute(div, 'style')).toBe(
      'background: #111111 url("https://i.pinimg.com/b.jpg") no-repeat center/cover; color: #fff',
    )
  })

  it('does not mark a background that is only a colour', () => {
    const source = '<div style="background-color: #fff; color: red">plain</div>'
    const html = lifted(source)
    expect(querySelectorAll(`[${EMAIL_BG_ATTR}]`, parse(html))).toHaveLength(0)
    expect(html).includes('style="background-color: #fff; color: red"')
  })

  it('does not mark background: none', () => {
    const source = '<div style="background: none">plain</div>'
    const html = lifted(source)
    expect(querySelectorAll(`[${EMAIL_BG_ATTR}]`, parse(html))).toHaveLength(0)
    expect(html).includes('style="background: none"')
  })

  it('does not mark elements without any background', () => {
    const html = lifted('<div style="color: red">plain</div><img src="https://i.pinimg.com/a.jpg">')
    expect(querySelectorAll(`[${EMAIL_BG_ATTR}]`, parse(html))).toHaveLength(0)
  })

  it('still marks a background whose data URI holds semicolons', () => {
    const html = lifted('<div style="background-image: url(&quot;data:image/svg+xml;base64,AAA;BBB&quot;)">x</div>')
    const div = querySelector('div', parse(html))!
    expect(getAttribute(div, EMAIL_BG_ATTR)).toBe('')
    expect(getAttribute(div, 'style')).toBe('background-image: url("data:image/svg+xml;base64,AAA;BBB")')
  })

  it('counts every marked element', () => {
    const doc = parse('<table><tr><td background="https://i.pinimg.com/a.jpg"></td></tr></table><div style="background-image:url(b.jpg)"></div><span>x</span>')
    expect(liftBackgroundImages(doc)).toBe(2)
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

    it('keeps the original background-image painted by the element itself', () => {
      // Nothing clears or repaints background images any more - dark mode
      // filters the marked element whole instead - so the image has to still be
      // there in light mode, from the sender's own declaration.
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
