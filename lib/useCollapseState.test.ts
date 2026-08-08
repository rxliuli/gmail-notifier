import { describe, it, expect } from 'vitest'
import { renderHook } from 'vitest-browser-react'
import { useCollapseState } from './useCollapseState'

describe('useCollapseState', () => {
  describe('initial state', () => {
    it('should initialize collapse state for 3 messages', async () => {
      const { result } = await renderHook(() => useCollapseState(3))

      expect(result.current.groupIndexes.size).toBe(0) // Don't collapse message groups
      expect(result.current.contentIndexes.size).toBe(2) // First two message contents collapsed
      expect(result.current.hasCollapsed).toBe(true)
      expect(result.current.hasGroup).toBe(false)
    })

    it('should initialize collapse state for 5 messages', async () => {
      const { result } = await renderHook(() => useCollapseState(5))

      expect(result.current.groupIndexes.size).toBe(2) // Middle 2 messages collapsed into group
      expect(result.current.contentIndexes.size).toBe(4) // First 4 message contents collapsed
      expect(result.current.hasCollapsed).toBe(true)
      expect(result.current.hasGroup).toBe(true)
    })
  })

  describe('toggleContent', () => {
    it('toggles a collapsed content index back to expanded', async () => {
      const { result, act } = await renderHook(() => useCollapseState(3))

      // First message content is collapsed by default, expand it
      await act(() => {
        result.current.toggleContent(0)
      })
      expect(result.current.contentIndexes.has(0)).toBe(false)

      // Collapse it again
      await act(() => {
        result.current.toggleContent(0)
      })
      expect(result.current.contentIndexes.has(0)).toBe(true)
    })

    it('the last message starts expanded and can be toggled like any other', async () => {
      const { result, act } = await renderHook(() => useCollapseState(3))

      expect(result.current.contentIndexes.has(2)).toBe(false)
      await act(() => {
        result.current.toggleContent(2)
      })
      expect(result.current.contentIndexes.has(2)).toBe(true)
    })
  })

  describe('expandGroup', () => {
    it('expands the collapsed message group', async () => {
      const { result, act } = await renderHook(() => useCollapseState(5))

      expect(result.current.groupIndexes.size).toBe(2)
      await act(() => {
        result.current.expandGroup()
      })
      expect(result.current.groupIndexes.size).toBe(0)
    })
  })

  describe('toggleAll', () => {
    it('handles toggle all for 3 messages (content only)', async () => {
      const { result, act } = await renderHook(() => useCollapseState(3))

      expect(result.current.contentIndexes.size).toBe(2)

      await act(() => {
        result.current.toggleAll()
      })
      expect(result.current.contentIndexes.size).toBe(0)

      await act(() => {
        result.current.toggleAll()
      })
      expect(result.current.contentIndexes.size).toBe(2)
    })

    it('handles toggle all for 5 messages (Gmail style)', async () => {
      const { result, act } = await renderHook(() => useCollapseState(5))

      expect(result.current.groupIndexes.size).toBe(2)
      expect(result.current.contentIndexes.size).toBe(4)

      // Expand all
      await act(() => {
        result.current.toggleAll()
      })
      expect(result.current.groupIndexes.size).toBe(0)
      expect(result.current.contentIndexes.size).toBe(0)

      // Collapse again: only content re-collapses, message groups stay expanded
      await act(() => {
        result.current.toggleAll()
      })
      expect(result.current.groupIndexes.size).toBe(0)
      expect(result.current.contentIndexes.size).toBe(4)
    })
  })

  describe('computed values', () => {
    it('computes hasCollapsed correctly as content is expanded', async () => {
      const { result, act } = await renderHook(() => useCollapseState(3))

      expect(result.current.hasCollapsed).toBe(true)

      await act(() => {
        result.current.toggleContent(0)
      })
      expect(result.current.hasCollapsed).toBe(true)

      await act(() => {
        result.current.toggleContent(1)
      })
      expect(result.current.hasCollapsed).toBe(false)
    })

    it('computes hasGroup independently of hasCollapsed', async () => {
      const { result, act } = await renderHook(() => useCollapseState(5))

      expect(result.current.hasGroup).toBe(true)
      expect(result.current.hasCollapsed).toBe(true)

      // Expand then re-collapse content only, keeping groups expanded
      await act(() => {
        result.current.toggleAll()
      })
      await act(() => {
        result.current.toggleAll()
      })
      expect(result.current.hasGroup).toBe(false)
      expect(result.current.hasCollapsed).toBe(true) // content collapsed, still true overall

      await act(() => {
        result.current.toggleAll()
      })
      expect(result.current.hasGroup).toBe(false)
      expect(result.current.hasCollapsed).toBe(false)
    })
  })
})
