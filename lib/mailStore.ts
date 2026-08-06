import { create } from 'zustand'
import type { EmailThread } from './StateManager'

// Pure UI/navigation state only - which thread is open, which screen is
// showing. Server state (email, threads) lives in React Query via
// useMailQuery instead: it was here too until every action that changed it
// (mark as read, archive, refresh button, ...) had to remember to manually
// re-pull storage afterward, and every missed spot was its own "popup looks
// out of sync" bug.
interface MailState {
  path: 'list' | 'detail' | 'debug'
  thread: EmailThread | null
  go: (thread: EmailThread) => void
  goDebugLog: () => void
  back: () => void
}

export const useMailStore = create<MailState>((set) => ({
  path: 'list',
  thread: null,
  go: (thread) => set({ path: 'detail', thread }),
  goDebugLog: () => set({ path: 'debug' }),
  back: () => set({ path: 'list' }),
}))
