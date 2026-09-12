import type { DefaultTreeAdapterMap } from 'parse5'
import { getAttribute, querySelectorAll, setAttribute } from './domutils'

type Element = DefaultTreeAdapterMap['element']
type Document = DefaultTreeAdapterMap['document']

// Marks an element whose background image was lifted, and records how it was
// written in the source so the dark-mode stylesheet knows which custom property
// to read it back from (see DARK_MODE_FILTER_STYLE in DetailPage.tsx).
export const EMAIL_BG_ATTR = 'data-email-bg'
export const EMAIL_BG_IMAGE = 'image'
export const EMAIL_BG_SHORTHAND = 'shorthand'
// `--email-bg-image` holds a background-image value (an image list); the
// longhands below carry whatever positioning the email gave that image.
const BG_IMAGE_PROP = '--email-bg-image'
const BG_SHORTHAND_PROP = '--email-bg-shorthand'
const BG_LONGHANDS = ['background-size', 'background-position', 'background-repeat'] as const

/**
 * Re-declares background images that are painted by an element itself (the
 * legacy HTML `background=` attribute, or an inline `background-image` /
 * `background: ... url(...)`) as custom properties that the dark-mode
 * stylesheet can repaint on an `::before` layer.
 *
 * Why this exists: dark mode inverts the whole email body with
 * `filter: invert(1) hue-rotate(180deg) brightness(1.5)` and cancels that back
 * out per element for `img`/`video`. A background image has no element of its
 * own to hang that second filter on, so it stayed fully inverted - a
 * photographic negative with the hue spun 180 degrees. Pinterest's board
 * emails make this very visible: their big collage tiles are
 * `<td background="...400x300.jpg" style="background-size:cover">`, while only
 * the small tiles next to them are real `<img>`s.
 *
 * The lifted value is only *read* by the dark-mode stylesheet: the element
 * keeps its own background declaration, so light mode renders exactly as it did
 * before and the only thing that changes is that dark mode can now repaint the
 * image on a layer it can filter.
 *
 * Only backgrounds written in the markup are covered (the attribute, or an
 * inline declaration). A background that only a <style> rule supplies is not:
 * the URL is not in the markup this runs over, and resolving it would mean
 * implementing a CSS cascade here.
 *
 * Mutates `container` in place; returns how many elements were marked.
 */
export function liftBackgroundImages(container: Element | Document): number {
  let lifted = 0
  for (const el of querySelectorAll('[background], [style]', container)) {
    const style = getAttribute(el, 'style') ?? ''
    const attr = getAttribute(el, 'background')?.trim() ?? ''
    // Cheap pre-filter: only the few elements that could possibly carry a
    // background image get their declarations split.
    const hasInlineBackground = /background(-image)?\s*:[^;"']*url\(/i.test(style)
    if (!attr && !hasInlineBackground) {
      continue
    }

    const decls = splitDeclarations(style)
    // Inline declarations win over the presentational `background` attribute,
    // and `background-image` wins over the shorthand, so precedence here
    // mirrors what the browser resolved.
    const shorthand = decls.find((it) => it.prop === 'background' && /url\(/i.test(it.value))?.value
    const image = decls.find((it) => it.prop === 'background-image' && /url\(/i.test(it.value))?.value
    let additions: string[]
    let kind: string
    if (image) {
      additions = [`${BG_IMAGE_PROP}: ${image}`, ...copyLonghands(decls)]
      kind = EMAIL_BG_IMAGE
    } else if (shorthand) {
      // The shorthand already carries size/position/repeat (and possibly a
      // colour), so handing the whole value to the layer's `background` is both
      // simpler and more faithful than trying to re-parse it into longhands.
      additions = [`${BG_SHORTHAND_PROP}: ${shorthand}`]
      kind = EMAIL_BG_SHORTHAND
    } else {
      additions = [`${BG_IMAGE_PROP}: ${toUrlValue(attr)}`, ...copyLonghands(decls)]
      kind = EMAIL_BG_IMAGE
    }

    setAttribute(el, EMAIL_BG_ATTR, kind)
    setAttribute(el, 'style', appendDeclarations(style, additions))
    lifted++
  }
  return lifted
}

function copyLonghands(decls: { prop: string; value: string }[]): string[] {
  return BG_LONGHANDS.flatMap((prop) => {
    const decl = decls.find((it) => it.prop === prop)
    return decl ? [`${prop.replace('background-', '--email-bg-')}: ${decl.value}`] : []
  })
}

// The HTML `background` attribute is a bare URL, but a few senders write it as
// a CSS value anyway - keep whichever form we were handed.
function toUrlValue(value: string): string {
  if (/^url\(/i.test(value)) {
    return value
  }
  return `url("${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`
}

function appendDeclarations(style: string, additions: string[]): string {
  const base = style.trim().replace(/;+$/, '')
  return [...(base ? [base] : []), ...additions].join('; ') + ';'
}

/**
 * Splits an inline style into declarations. A naive `split(';')` would also cut
 * inside `url(...)` (and inside quoted strings), which is exactly what data:
 * URIs and quoted font names look like, so track parenthesis depth and quotes.
 */
export function splitDeclarations(style: string): { prop: string; value: string }[] {
  const decls: { prop: string; value: string }[] = []
  let current = ''
  let depth = 0
  let quote = ''
  const flush = () => {
    const colon = current.indexOf(':')
    if (colon > 0) {
      decls.push({ prop: current.slice(0, colon).trim().toLowerCase(), value: current.slice(colon + 1).trim() })
    }
    current = ''
  }
  for (const char of style) {
    if (quote) {
      if (char === quote) {
        quote = ''
      }
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '(') {
      depth++
    } else if (char === ')') {
      depth = Math.max(0, depth - 1)
    } else if (char === ';' && depth === 0) {
      flush()
      continue
    }
    current += char
  }
  flush()
  return decls.filter((it) => it.value !== '')
}
