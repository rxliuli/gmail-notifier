import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fakeBrowser } from '@webext-core/fake-browser'

vi.stubGlobal('browser', fakeBrowser)

const { debugLog, getDebugLogs, clearDebugLogs } = await import('./debugLog')

describe('debugLog', () => {
  beforeEach(() => {
    fakeBrowser.reset()
  })

  it('persists a log entry that getDebugLogs can read back', async () => {
    await debugLog('hello', { a: 1 })
    const logs = await getDebugLogs()
    expect(logs).length(1)
    expect(logs[0]).includes('hello').includes('{"a":1}')
  })

  it('appends across multiple calls, oldest first', async () => {
    await debugLog('first')
    await debugLog('second')
    const logs = await getDebugLogs()
    expect(logs).length(2)
    expect(logs[0]).includes('first')
    expect(logs[1]).includes('second')
  })

  it('caps the buffer instead of growing unbounded', async () => {
    for (let i = 0; i < 305; i++) {
      await debugLog(`entry-${i}`)
    }
    const logs = await getDebugLogs()
    expect(logs).length(300)
    expect(logs[0]).includes('entry-5')
    expect(logs[299]).includes('entry-304')
  })

  it('clearDebugLogs empties the buffer', async () => {
    await debugLog('will be cleared')
    await clearDebugLogs()
    expect(await getDebugLogs()).toEqual([])
  })

  it('returns an empty array when nothing has been logged yet', async () => {
    expect(await getDebugLogs()).toEqual([])
  })
})
