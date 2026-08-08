import { useState } from 'react'

interface CollapseState {
  // Which message contents are collapsed
  contentIndexes: Set<number>
  // Which messages are collapsed into a message group
  groupIndexes: Set<number>
}

function computeDefaults(count: number): CollapseState {
  return {
    // Default: collapse all except first and last two
    groupIndexes: count > 3 ? new Set(Array.from({ length: count - 3 }, (_, i) => i + 1)) : new Set(),
    contentIndexes: count > 1 ? new Set(Array.from({ length: count - 1 }, (_, i) => i)) : new Set(),
  }
}

// Local to whichever DetailPage is currently mounted, keyed by threadUrl
// (see router.tsx) - not a global store. Collapse state only ever makes
// sense for whichever thread is currently open, and keying the remount on
// threadUrl gives every thread a fresh default collapse state for free,
// without needing an effect to push a new messageCount in after the initial
// render (the previous version of this was a Zustand store with a separate
// setCount action, called from a useEffect for exactly that reason).
export function useCollapseState(count: number) {
  const [state, setState] = useState(() => computeDefaults(count))

  const hasCollapsed = state.contentIndexes.size > 0 || state.groupIndexes.size > 0
  const hasGroup = state.groupIndexes.size > 0

  function toggleContent(index: number) {
    setState((s) => {
      const next = new Set(s.contentIndexes)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return { ...s, contentIndexes: next }
    })
  }

  function expandGroup() {
    setState((s) => ({ ...s, groupIndexes: new Set() }))
  }

  function toggleAll() {
    setState((s) => {
      if (s.contentIndexes.size > 0 || s.groupIndexes.size > 0) {
        return { contentIndexes: new Set(), groupIndexes: new Set() }
      }
      // Only re-collapse content, keep message groups expanded - matches
      // Gmail's own behavior once a thread's groups have been opened.
      return { groupIndexes: s.groupIndexes, contentIndexes: new Set(Array.from({ length: count - 1 }, (_, i) => i)) }
    })
  }

  return {
    contentIndexes: state.contentIndexes,
    groupIndexes: state.groupIndexes,
    hasCollapsed,
    hasGroup,
    toggleContent,
    expandGroup,
    toggleAll,
  }
}
