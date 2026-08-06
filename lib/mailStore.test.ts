import { describe, it, expect, beforeEach } from 'vitest'

const { useMailStore } = await import('./mailStore')

describe('mailStore', () => {
  beforeEach(() => {
    useMailStore.setState({ path: 'list', thread: null })
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

  it('goDebugLog() switches to the debug log view', () => {
    useMailStore.getState().goDebugLog()
    expect(useMailStore.getState().path).toBe('debug')
  })
})
