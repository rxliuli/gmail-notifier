import { create } from 'zustand'
import { EmailThread } from './StateManager'

interface MailState {
  path: 'list' | 'detail'
  email: string | null
  threads: EmailThread[]
  thread: EmailThread | null
  go: (thread: EmailThread) => void
  back: () => void
  refresh: () => Promise<void>
}

export const useMailStore = create<MailState>((set, get) => ({
  path: 'list',
  email: null,
  threads: [],
  thread: null,
  go: async (thread) => {
    set({
      path: 'detail',
      thread,
    })
  },
  back: () => set({ path: 'list' }),
  refresh: async () => {
    const { email, threads } = await browser.storage.session.get<{
      email: string
      threads: EmailThread[]
    }>(['email', 'threads'])
    set({ email, threads })
  },
}))
