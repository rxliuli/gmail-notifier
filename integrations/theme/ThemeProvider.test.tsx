import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { ThemeProvider, useTheme } from './ThemeProvider'
import { ShadowProvider } from '../shadow/ShadowProvider'

function ThemeSwitcher() {
  const { setTheme } = useTheme()
  return (
    <>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setTheme('light')}>light</button>
    </>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    document.body.classList.remove('light', 'dark')
    localStorage.clear()
  })

  it('applies a light/dark class to the body once resolved', async () => {
    const screen = render(
      <ShadowProvider container={document.body}>
        <ThemeProvider>
          <ThemeSwitcher />
        </ThemeProvider>
      </ShadowProvider>,
    )
    await expect.element(screen.getByText('dark')).toBeInTheDocument()
    // Wait for the resolvedTheme effect to settle.
    await vi.waitUntil(() => document.body.classList.contains('light') || document.body.classList.contains('dark'))
    expect(document.body.classList.contains('light') || document.body.classList.contains('dark')).toBe(true)
  })

  it('switches the body class when the theme changes', async () => {
    const screen = render(
      <ShadowProvider container={document.body}>
        <ThemeProvider>
          <ThemeSwitcher />
        </ThemeProvider>
      </ShadowProvider>,
    )
    await screen.getByText('dark').click()
    await vi.waitUntil(() => document.body.classList.contains('dark'))
    expect(document.body.classList.contains('dark')).toBe(true)
    expect(document.body.classList.contains('light')).toBe(false)

    await screen.getByText('light').click()
    await vi.waitUntil(() => document.body.classList.contains('light'))
    expect(document.body.classList.contains('light')).toBe(true)
    expect(document.body.classList.contains('dark')).toBe(false)
  })
})
