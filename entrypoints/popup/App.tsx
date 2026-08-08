import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { router } from './router'
import { bgMessager, popupMessager } from '@/lib/messager'
import { mailQueryKey } from '@/lib/useMailQuery'
import { queryClient } from '@/lib/queryClient'
import { useEffectOnce } from '@/lib/utils/useEffectOnce'

function AppContent() {
  const queryClient = useQueryClient()
  useEffectOnce(() => {
    // Lives here, not in a specific route's component: this has to run once
    // per popup session, not once per visit to whichever route happens to
    // mount it. useMailQuery already reads whatever background last wrote
    // as soon as any component using it mounts - no separate "show cached
    // snapshot" pull needed. This only needs to (a) invalidate the query
    // when background pushes 'refreshPopup', so any mounted useMailQuery
    // re-reads storage, and (b) kick off an actual fresh remote fetch,
    // since background's own alarm/webRequest triggers only run on their
    // own schedule and without this the popup can sit on stale data until
    // one of those fires.
    popupMessager.onMessage('refreshPopup', () => {
      queryClient.invalidateQueries({ queryKey: mailQueryKey })
    })
    bgMessager.sendMessage('refreshThreads', undefined)
    return () => {
      popupMessager.removeAllListeners()
    }
  })
  return <RouterProvider router={router} />
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster richColors={true} closeButton={true} />
      <AppContent />
    </QueryClientProvider>
  )
}

export default App
