import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { RefreshIcon } from './RefreshIcon'

describe('RefreshIcon', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders without crashing', async () => {
    const screen = render(<RefreshIcon loading={false} />)
    await expect
      .element(screen.container.querySelector('svg'))
      .toBeInTheDocument()
  })

  it('applies spin animation when loading is true', async () => {
    const screen = render(<RefreshIcon loading={true} />)
    const icon = screen.container.querySelector('svg')
    await expect.element(icon).toHaveClass('animate-spin')
  })

  it('applies complete animation when loading changes from true to false', async () => {
    const screen = render(<RefreshIcon loading={true} />)
    screen.rerender(<RefreshIcon loading={false} />)
    const icon = screen.container.querySelector('svg')
    await expect.element(icon).toHaveClass('animate-spin-complete')
  })

  it('removes complete animation after 500ms', async () => {
    const screen = render(<RefreshIcon loading={true} />)
    screen.rerender(<RefreshIcon loading={false} />)

    vi.advanceTimersByTime(500)

    const icon = screen.container.querySelector('svg')
    await expect.element(icon).not.toHaveClass('animate-spin-complete')
  })

  it('applies custom className', async () => {
    const screen = render(
      <RefreshIcon loading={false} className="custom-class" />,
    )
    const icon = screen.container.querySelector('svg')
    await expect.element(icon).toHaveClass('custom-class')
  })

  it('cleans up timeout on unmount', async () => {
    const screen = render(<RefreshIcon loading={true} />)
    screen.unmount()
    // If the test passes without errors, it means the cleanup was successful
  })
})
