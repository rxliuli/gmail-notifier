export function createStyleSheets(styles: string[]): CSSStyleSheet[] {
  return styles
    .map((style) => {
      const sheet = new CSSStyleSheet()
      try {
        sheet.replaceSync(style.replaceAll(':root', ':host'))
      } catch (err) {
        console.error('addStyle: failed to parse email style', err)
        return null
      }
      return sheet
    })
    .filter((sheet): sheet is CSSStyleSheet => sheet !== null)
}

export function addStyle(shadow: ShadowRoot, styles: string[]) {
  shadow.adoptedStyleSheets = createStyleSheets(styles)
}
