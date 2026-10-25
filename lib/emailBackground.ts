import type { DefaultTreeAdapterMap } from 'parse5'
import { getAttribute, querySelectorAll, setAttribute } from './domutils'

type Element = DefaultTreeAdapterMap['element']
type Document = DefaultTreeAdapterMap['document']

// Marks an element that paints a background image itself - see
// liftBackgroundImages for what is marked and why. The dark-mode stylesheet
// (DARK_MODE_RULES in entrypoints/popup/pages/DetailPage.tsx) is the only
// reader: it renders a marked element, and its whole subtree, as-is.
export const EMAIL_BG_ATTR = 'data-email-bg'

/**
 * Marks every element that paints a background image itself, with the legacy
 * `background=` attribute or an inline `background-image` / `background:
 * ... url(...)` declaration. The dark-mode stylesheet then renders that element
 * *and its whole subtree* as-is, with the same cancellation filter
 * `img`/`video` already get - hung on the element instead of on a
 * pseudo-element.
 *
 * Why a marker at all: dark mode inverts the entire email body with
 * `filter: invert(1) hue-rotate(180deg) brightness(1.5)` and cancels that back
 * out per element for `img`/`video`. A background image has no element of its
 * own to hang that second filter on, so left alone it stayed fully inverted - a
 * photographic negative with the hue spun 180 degrees. Pinterest's board mails
 * make this very visible: their big collage tiles are
 * `<td background="...400x300.jpg" style="background-size:cover">`, while only
 * the small tiles next to them are real `<img>`s. Bank "statement" mails are
 * the other shape, with `<table background="...png">` carrying the copy.
 *
 * What this used to do, and why it no longer does:
 *
 * The first fix cleared `background-image` on the element and repainted the
 * image on a `::before` layer, carried over as custom properties (one per
 * background longhand, plus one for the shorthand) written into the inline
 * style here. It made the *artwork* render at its original colours, but it
 * could only compensate the layer: the text inside the same element was still
 * inverted, so copy on a light board came out white-on-white and vanished.
 *
 * To paper over that, a message-global heuristic decided whether a mail was a
 * "design board" and dropped the whole dark-mode stylesheet for it (an
 * `isBoard` test keyed on a 20-character copy threshold, recorded on the block
 * as a boolean marker attribute). That threshold is gone, and the measurements
 * below are why it cannot come back in any form:
 *
 * - The China Merchants Bank "每日信用管家" mail, measured on the real thing
 *   (Gmail's view=pt HTML, the one extractThreadMail parses): 129
 *   non-whitespace characters of body copy, laid out over five stacked
 *   background-image tables carrying 52, 19, 58, 0 and 0 characters - the
 *   header banner, the "额度和积分" block, the "消费明细" block, and two
 *   picture-only tiles. So it is not one giant 660x950 canvas: it is several
 *   bg-image blocks, of which the two carrying copy hold 40% and 45% of the
 *   message's copy.
 * - A captioned decorative banner - 23 characters ("shorthand banner with
 *   text") on the Pinterest mail in lib/api/assets/content-background.html,
 *   inside a body carrying ~142 characters of copy - is 16% of its message.
 *
 * No absolute threshold, no share-of-copy test and no 200-character escape
 * hatch separates those two: the rule lenient enough to let the 23-character
 * banner through is the rule that loses the 58-character block of a real board,
 * because board mails are precisely the ones with long off-board boilerplate (a
 * statement plus its disclaimer, a card plus its terms). A board mail is many
 * bg-image blocks, not one canvas, so any "this element holds most of the
 * message's copy" test necessarily conflates it with a captioned banner.
 *
 * So the decision is per element now, and it is the same decision for every
 * background-image block: render it as-is. That is what `img`/`video` already
 * do, so the result is the one users already understand - artwork at its
 * original colours, text at the contrast its sender chose (dark on a light
 * board, white on a dark banner). A wrong decision costs that one block instead
 * of the whole message, which is what makes dropping the threshold safe.
 *
 * The tradeoff this accepts: a sender who puts *low-contrast* text on a
 * background image keeps that low contrast in dark mode, because the block is
 * now rendered the way they designed it instead of having its copy
 * re-inverted.
 *
 * Only backgrounds written in the markup are covered (the attribute, or an
 * inline declaration). A background that only a <style> rule supplies is not:
 * the URL is not in the markup this runs over, and resolving it would mean
 * implementing a CSS cascade here.
 *
 * Nothing but this one attribute is added: the element keeps its own `style`
 * and `background` attribute untouched, so light mode renders byte-for-byte
 * what it rendered before, and the stored contentHtml only shrinks (the custom
 * properties are gone).
 *
 * Mutates `container` in place; returns how many elements were marked.
 */
export function liftBackgroundImages(container: Element | Document): number {
  let marked = 0
  for (const el of querySelectorAll('[background], [style]', container)) {
    const attr = getAttribute(el, 'background')?.trim() ?? ''
    const style = getAttribute(el, 'style') ?? ''
    // Cheap pre-filter, case-insensitive: only a `background`/`background-image`
    // declaration that reaches a `url(` before its `;`, quote or the end of the
    // attribute can paint an image. A background that is only a colour or
    // `none` stays unmarked - it needs no compensation, since dark mode is
    // supposed to recolour it.
    const hasImage = attr !== '' || /background(-image)?\s*:[^;"']*url\(/i.test(style)
    if (!hasImage) {
      continue
    }
    setAttribute(el, EMAIL_BG_ATTR, '')
    marked++
  }
  return marked
}
