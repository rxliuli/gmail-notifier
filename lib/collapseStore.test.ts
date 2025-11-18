import { describe, it, expect, beforeEach } from 'vitest'
import { useCollapseStore as store } from './collapseStore'

describe('CollapseStore', () => {
  beforeEach(() => {
    // Reset store state
    store.getState().setCount(0)
  })

  describe('setMessageCount', () => {
    it('should initialize collapse state for 3 messages', () => {
      store.getState().setCount(3)
      const state = store.getState()

      expect(state.count).toBe(3)
      expect(state.groupIndexes.size).toBe(0) // Don't collapse message groups
      expect(state.contentIndexes.size).toBe(2) // First two message contents collapsed
      expect(state.hasCollapsed).toBe(true)
      expect(state.hasGroup).toBe(false)
    })

    it('should initialize collapse state for 5 messages', () => {
      store.getState().setCount(5)
      const state = store.getState()

      expect(state.count).toBe(5)
      expect(state.groupIndexes.size).toBe(2) // Middle 2 messages collapsed into group
      expect(state.contentIndexes.size).toBe(4) // First 4 message contents collapsed
      expect(state.hasCollapsed).toBe(true)
      expect(state.hasGroup).toBe(true)
    })
  })

  describe('toggleContent', () => {
    it('should not allow collapsing last message content', () => {
      store.getState().setCount(3)
      const state = store.getState()

      // Try to collapse last message content
      state.toggleContent(2)

      expect(state.contentIndexes.has(2)).toBe(false)
    })

    it('should toggle content collapse state', () => {
      store.getState().setCount(3)
      const state = store.getState()

      // First message content is collapsed by default, expand it
      state.toggleContent(0)
      expect(store.getState().contentIndexes.has(0)).false

      // Collapse again
      state.toggleContent(0)
      expect(store.getState().contentIndexes.has(0)).true
    })
  })

  describe('expandMessageGroup', () => {
    it('should expand a group of messages', () => {
      store.getState().setCount(5)
      const state = store.getState()

      // Expand middle message group (index 1 and 2)
      state.expandGroup()

      expect(store.getState().groupIndexes.has(1)).toBe(false)
      expect(store.getState().groupIndexes.has(2)).toBe(false)
    })
  })

  describe('toggleAll', () => {
    it('should handle toggle all for 3 messages (content only)', () => {
      store.getState().setCount(3)
      const state = store.getState()

      // Initial state: content collapsed
      expect(state.contentIndexes.size).eq(2)

      // Expand all
      state.toggleAll()
      expect(store.getState().contentIndexes.size).eq(0)

      // Collapse all
      state.toggleAll()
      expect(store.getState().contentIndexes.size).eq(2)
    })

    it('should handle toggle all for 5 messages (Gmail style)', () => {
      store.getState().setCount(5)
      const state = store.getState()

      // Initial state: message groups and content both collapsed
      expect(state.groupIndexes.size).eq(2)
      expect(state.contentIndexes.size).eq(4)

      // Expand all
      state.toggleAll()
      expect(store.getState().groupIndexes.size).eq(0)
      expect(store.getState().contentIndexes.size).eq(0)

      // Collapse all (only collapse content, keep message groups expanded)
      state.toggleAll()
      expect(store.getState().groupIndexes.size).eq(0) // Message groups stay expanded
      expect(store.getState().contentIndexes.size).eq(4) // Content collapsed
    })
  })

  describe('computed values', () => {
    it('should compute allCollapsed correctly', () => {
      store.getState().setCount(5)
      const state = store.getState()

      // Initial state: message groups collapsed
      expect(store.getState().groupIndexes.size).eq(2)

      // Expand message groups
      state.expandGroup()
      expect(store.getState().groupIndexes.size).eq(0)
    })

    it('should compute hasCollapsed correctly', () => {
      store.getState().setCount(3)
      const state = store.getState()

      // Initial state: content collapsed
      expect(store.getState().hasCollapsed).true

      // Expand content
      state.toggleContent(0)
      expect(store.getState().hasCollapsed).true
      state.toggleContent(1)
      expect(store.getState().hasCollapsed).false
    })

    it('should compute hasGroup correctly', () => {
      store.getState().setCount(5)
      const state = store.getState()

      // Initial state: message groups and content both collapsed
      expect(store.getState().hasGroup).true
      expect(store.getState().hasCollapsed).true

      // Only expand content
      state.toggleAll()
      state.toggleAll() // Collapse content, keep message groups expanded
      expect(store.getState().hasGroup).false
      expect(store.getState().hasCollapsed).true // Content collapsed, so overall still collapsed

      // Expand content
      state.toggleAll()
      expect(store.getState().hasGroup).false
      expect(store.getState().hasCollapsed).false // Content expanded, so overall expanded
    })
  })
})
