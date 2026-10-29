import { useQuery } from '@tanstack/react-query'
import type { EmailThread } from './StateManager'

// Single source of truth for "what does background last know" on the popup
// side. Background (StateManager.notify()) is the only writer of
// storage.local's accounts/threads; every reader here goes through this one
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

// Exported separately from useMailQuery so the detail route's loader can
// call queryClient.ensureQueryData(...) with this same queryFn - that way
// mailQuery.data is already warm by the time DetailPage's first render
// happens, instead of that render seeing an empty/loading state first.
export async function fetchMailQuery() {
  const { accounts, threads } = await browser.storage.local.get<{
    accounts: string[]
    threads: EmailThread[]
  }>(['accounts', 'threads'])
  return { accounts: accounts ?? [], threads: threads ?? [] }
}

export function useMailQuery() {
  return useQuery({
    queryKey: mailQueryKey,
    queryFn: fetchMailQuery,
  })
}
