import { create } from 'zustand'
import { createComputed } from 'zustand-computed'
import { ReadonlyKeysOf } from 'type-fest'

interface CollapseState {
  // Which message contents are collapsed
  contentIndexes: Set<number>
  // Which messages are collapsed into message groups
  groupIndexes: Set<number>
  // Total number of messages
  count: number

  // Actions
  // Set total message count
  setCount: (count: number) => void
  // Expand/collapse message content
  toggleContent: (index: number) => void
  // Expand message group (but cannot collapse after expansion, can only collapse all message content)
  expandGroup: () => void
  // Expand/collapse all message content, if message group exists, also expand it
  toggleAll: () => void

  // Computed values
  // Whether any message content is collapsed, or message group is collapsed
  readonly hasCollapsed: boolean
  // Whether any message group is collapsed
  readonly hasGroup: boolean
}

function newComputed<S extends object>(compute: (state: Omit<S, ReadonlyKeysOf<S>>) => Pick<S, ReadonlyKeysOf<S>>) {
  return createComputed<Omit<S, ReadonlyKeysOf<S>>, Pick<S, ReadonlyKeysOf<S>>>((state) => compute(state))
}

const computed = newComputed<CollapseState>((state) => ({
  hasCollapsed: state.contentIndexes.size > 0 || state.groupIndexes.size > 0,
  hasGroup: state.groupIndexes.size > 0,
}))

export const useCollapseStore = create(
  computed((set, get) => ({
    contentIndexes: new Set(),
    groupIndexes: new Set(),
    count: 0,
    setCount: (count) =>
      set((state) => {
        const newState = { ...state, count }
        if (count <= 3) {
          newState.groupIndexes = new Set()
        } else {
          // Default: collapse all except first and last two
          newState.groupIndexes = new Set(Array.from({ length: count - 3 }, (_, i) => i + 1))
        }
        if (count <= 1) {
          newState.contentIndexes = new Set()
        } else {
          newState.contentIndexes = new Set(Array.from({ length: count - 1 }, (_, i) => i))
        }
        return newState
      }),

    toggleContent: (index) =>
      set((state) => {
        const next = new Set(state.contentIndexes)
        if (next.has(index)) {
          next.delete(index)
        } else {
          next.add(index)
        }
        return { contentIndexes: next }
      }),

    expandGroup: () =>
      set(() => {
        return { groupIndexes: new Set() }
      }),

    toggleAll: () =>
      set((state) => {
        if (get().hasCollapsed) {
          return { contentIndexes: new Set(), groupIndexes: new Set() }
        }
        return { contentIndexes: new Set(Array.from({ length: state.count - 1 }, (_, i) => i)) }
      }),
  })),
)
