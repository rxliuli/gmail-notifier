import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerActionMenus } from './menu'

describe('registerActionMenus', () => {
  let create: ReturnType<typeof vi.fn>

  beforeEach(() => {
    create = vi.fn()
    vi.stubGlobal('browser', { contextMenus: { create } })
  })

  it('registers a top-level menu with no submenus', () => {
    registerActionMenus([{ id: 'refresh', title: 'Refresh' }])
    expect(create).toBeCalledTimes(1)
    expect(create).toBeCalledWith({ id: 'refresh', title: 'Refresh', contexts: ['action'] })
  })

  it('registers submenus under their parent id', () => {
    registerActionMenus([
      {
        id: 'do-not-disturb',
        title: 'Do not disturb',
        submenus: [
          { id: 'off', title: 'Turn off' },
          { type: 'separator' },
          { id: '30m', title: '30 minutes' },
        ],
      },
    ])
    expect(create).toBeCalledTimes(4)
    expect(create).toHaveBeenNthCalledWith(1, {
      id: 'do-not-disturb',
      title: 'Do not disturb',
      contexts: ['action'],
    })
    expect(create).toHaveBeenNthCalledWith(2, { id: 'off', title: 'Turn off', contexts: ['action'], parentId: 'do-not-disturb' })
    expect(create).toHaveBeenNthCalledWith(3, { type: 'separator', parentId: 'do-not-disturb' })
    expect(create).toHaveBeenNthCalledWith(4, { id: '30m', title: '30 minutes', contexts: ['action'], parentId: 'do-not-disturb' })
  })

  it('throws for an unknown submenu type', () => {
    expect(() =>
      registerActionMenus([
        { id: 'x', title: 'X', submenus: [{ type: 'unknown' } as any] },
      ]),
    ).toThrow('Unknown submenu type')
  })
})
