import { useQuery } from '@tanstack/react-query'
import type { EmailThread } from './StateManager'

// Single source of truth for "what does background last know" on the popup
// side. Background (StateManager.notify()) is the only writer of
// storage.local's email/threads; every reader here goes through this one
// query instead of each call site hand-rolling its own read-after-action.
//
// This deliberately doesn't try to trigger the actual remote Gmail fetch -
// that only happens in background (via 'refreshThreads' or its own
// alarm/webRequest triggers). This hook only reads whatever background last
// wrote. Call `queryClient.invalidateQueries({ queryKey: mailQueryKey })`
// after anything that can change that data - a background push arriving, or
// a message to background that's expected to have updated it - and every
// component using this hook re-renders with the fresh value automatically,
// instead of each call site needing to remember to pull state itself.
export const mailQueryKey = ['mail'] as const

export function useMailQuery() {
  return useQuery({
    queryKey: mailQueryKey,
    queryFn: async () => {
      const { email, threads } = await browser.storage.local.get<{
        email: string | null
        threads: EmailThread[]
      }>(['email', 'threads'])
      return { email: email ?? null, threads: threads ?? [] }
    },
  })
}
