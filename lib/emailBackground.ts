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

// Marks a lifted element that is not just a picture but the message's *design
// board*: its background image is the page, and the copy is laid out on top of
// it. Turns the whole message into a "do not invert" one, see isBoard below.
export const EMAIL_BOARD_ATTR = 'data-email-board'

// How much text a lifted element has to carry before it counts as a board
// rather than a decorative tile or a background-image button.
//
// This is the one place the two kinds of lifted element are told apart, and the
// number is a compromise in both directions. Buttons and badges painted with a
// background image carry a handful of characters ("立即享权益" = 5, "点击领取 50
// 元还款金" = 13, "Buy now" = 7), while a board carries whole sentences (the
// mail this was written for carries ~450 characters of copy over one 660x950
// image). 20 sits between the two with room on both sides: high enough that a
// CTA cannot flip a whole message to light mode, low enough that a board with
// unusually terse copy is still caught - staying *below* the real board length
// is the safer error, because the cost of a missed board is invisible text,
// while the cost of a false positive is only that the message keeps its
// original colours.
export const BOARD_TEXT_MIN = 20

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
 * Lifting an element that also carries text is a special case, tagged with
 * EMAIL_BOARD_ATTR instead of just EMAIL_BG_ATTR - see isBoard's comment.
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
    if (isBoard(el)) {
      setAttribute(el, EMAIL_BOARD_ATTR, '')
    }
    lifted++
  }
  return lifted
}

/**
 * A "design board": one background image that is the whole layout, with the
 * email's copy sitting directly on top of it.
 *
 * These messages cannot be darkened by inverting them, and cannot be left
 * half-inverted either, so they need to be recognised here (where the DOM is)
 * and handled as an exception by the dark-mode stylesheet (DetailPage.tsx):
 *
 * - The compensation above makes the board render at its *original* colours
 *   (a white board stays white - verified pixel-exact, which is also what
 *   `img`/`video` get, so the artwork of a board mail always stays light).
 * - The copy on top is not compensated: it is still inverted, and
 *   `brightness(1.5)` clamps any source channel below #55 to pure white. Body
 *   text (#000 / #404040) therefore lands on #FFFFFF - the exact same white as
 *   the board underneath it, so the whole message turns blank. Confirmed live
 *   on a China Merchants Bank statement mail: a white board with a red frame
 *   and every word of copy invisible.
 * - Dropping the compensation instead (the pre-5f34b80 behaviour) makes the
 *   board invert to near-black, which *does* restore the text - but it also
 *   turns every photo/graphic inside the board into a negative, which is the
 *   bug 5f34b80 fixed.
 *
 * Neither half-inverted mix is right, so a board mail is rendered as-is
 * (no invert filter at all). That keeps the original 9.7:1 contrast between
 * #404040 copy and the #FFFFFF board, and is also what every reference
 * implementation ends up doing with these mails: mobile Gmail's dark mode and
 * Dark Reader both leave the board untouched and merely lift the text colour
 * to ~#B4B4B4 (measured, 2.2:1) - they never invert the artwork either.
 */
function isBoard(el: Element): boolean {
  // Whole subtree, not just direct children: on real board mails the copy is
  // nested several tables deep.
  return copyLength(el, BOARD_TEXT_MIN) >= BOARD_TEXT_MIN
}

// Elements whose contents are source code, not copy: a body-level <style> with
// three declarations is already longer than BOARD_TEXT_MIN (emails do ship
// those), and reading that as "this image has text written on it" would flip a
// mail to light mode for no reason at all. <title>/<head> are metadata for the
// same reason.
const NON_COPY_ELEMENTS = new Set(['style', 'script', 'template', 'title', 'head'])

/**
 * Non-whitespace characters of rendered copy inside `node`, counting at most
 * `budget` of them - the walk stops as soon as the budget is spent, since a
 * board holds hundreds of characters and nothing past the threshold changes the
 * answer.
 *
 * Not `domutils.getTextContent`: that concatenates every text node, including
 * <style>/<script> source and <title>, and only trims the ends - so indentation
 * between tags and &nbsp;-padded table cells, which real mail templates are full
 * of, would all read as copy.
 */
function copyLength(node: DefaultTreeAdapterMap['node'], budget: number): number {
  if (budget <= 0) {
    return 0
  }
  // A text node never has children, so this is the recursion's only leaf.
  if (node.nodeName === '#text') {
    let counted = 0
    for (const char of (node as DefaultTreeAdapterMap['textNode']).value) {
      if (!/\s/.test(char) && ++counted >= budget) {
        break
      }
    }
    return counted
  }
  if (NON_COPY_ELEMENTS.has(node.nodeName)) {
    return 0
  }
  // Guards the comment/intermediate nodes the union also carries: they have no
  // children to walk (and no text either).
  if (!('childNodes' in node)) {
    return 0
  }
  let total = 0
  for (const child of node.childNodes) {
    total += copyLength(child, budget - total)
    if (total >= budget) {
      break
    }
  }
  return total
}

/**
 * Whether a message's HTML (as lifted by liftBackgroundImages) contains a
 * design board, i.e. whether dark mode has to leave this message alone.
 *
 * String test rather than a parse: the attribute was written by
 * liftBackgroundImages two steps ago in the same pipeline, the popup already
 * receives contentHtml as a string, and the alternative - re-parsing every
 * message body on every render - would cost far more than it buys.
 */
export function hasBoardImage(contentHtml: string): boolean {
  return contentHtml.includes(`${EMAIL_BOARD_ATTR}="`)
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
