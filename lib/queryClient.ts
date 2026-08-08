import { QueryClient } from '@tanstack/react-query'

// One shared instance between App.tsx (QueryClientProvider) and the detail
// route's loader (router.tsx) - the loader calls ensureQueryData on this
// same client so DetailPage's own useMailQuery() call sees already-warm
// data on its first render, instead of a separate, independent fetch.
export const queryClient = new QueryClient()
