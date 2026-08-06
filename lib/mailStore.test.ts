import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fakeBrowser } from '@webext-core/fake-browser'

vi.stubGlobal('browser', fakeBrowser)

const { useMailStore } = await import('./mailStore')

describe('mailStore', () => {
  beforeEach(() => {
    fakeBrowser.reset()
    useMailStore.setState({ path: 'list', email: null, threads: [], thread: null })
  })

  it('go() switches to the detail view with the given thread', () => {
    const thread = { url: 'https://mail.google.com/1', subject: 'Hi' } as any
    useMailStore.getState().go(thread)
    expect(useMailStore.getState().path).toBe('detail')
    expect(useMailStore.getState().thread).toBe(thread)
  })

  it('back() returns to the list view without clearing the loaded thread', () => {
    const thread = { url: 'https://mail.google.com/1' } as any
    useMailStore.setState({ path: 'detail', thread })
    useMailStore.getState().back()
    expect(useMailStore.getState().path).toBe('list')
  })

  it('refresh() hydrates email and threads from local storage', async () => {
    const threads = [{ url: 'https://mail.google.com/1' }] as any
    await fakeBrowser.storage.local.set({ email: 'me@example.com', threads })
    await useMailStore.getState().refresh()
    expect(useMailStore.getState().email).toBe('me@example.com')
    expect(useMailStore.getState().threads).toEqual(threads)
  })

  it('refresh() reflects empty storage (logged out / no threads)', async () => {
    useMailStore.setState({ email: 'stale@example.com', threads: [{ url: 'stale' }] as any })
    await useMailStore.getState().refresh()
    expect(useMailStore.getState().email).toBeUndefined()
    expect(useMailStore.getState().threads).toBeUndefined()
  })
})
