import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  redirect,
  Outlet,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { IndexPage } from './pages/IndexPage'
import { DetailPage } from './pages/DetailPage'
import { DebugLogPage } from './pages/DebugLogPage'
import { fetchMailQuery, mailQueryKey } from '@/lib/useMailQuery'
import { queryClient } from '@/lib/queryClient'

function RootComponent() {
  // The router's own `scrollRestoration: true` option didn't actually reset
  // scroll here (confirmed live: documentElement.scrollTop stayed at its
  // old value after navigating) - that feature is built around real
  // browser/hash history, and apparently has a blind spot with memory
  // history. Force it directly instead of trusting the built-in.
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  useEffect(() => {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [pathname])
  return <Outlet />
}

const rootRoute = createRootRoute({
  component: RootComponent,
})

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexPage,
})

// threadUrl is the thread's own Gmail URL, encodeURIComponent'd so it stays
// within a single path segment (it contains its own slashes/query string).
//
// Checking the thread actually exists here, before DetailPage ever mounts,
// replaces what used to be a post-render useEffect that navigated back to
// '/' once it noticed mailQuery had resolved with no matching thread. That
// effect fired on *any* mailQuery update while mounted, including ones that
// landed mid-navigation (e.g. right as the 'viewed' message's notify() was
// still propagating) - looking like the detail page flashing open and then
// immediately bouncing back to the list. A loader runs once, synchronously
// as part of the navigation itself, so there's no window for an in-flight
// background update to be mistaken for "this thread doesn't exist".
//
// ensureQueryData (not a raw storage read) so the same data DetailPage's
// own useMailQuery() call will read is already warm in the cache by the
// time it first renders - see DetailRouteComponent's key below for why that
// matters.
function DetailRouteComponent() {
  const { threadUrl } = detailRoute.useParams()
  // Remounts DetailPage (and resets its local collapse state) whenever the
  // thread changes, instead of needing an effect to sync derived state to a
  // new messageCount on every navigation.
  return <DetailPage key={threadUrl} />
}

export const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/detail/$threadUrl',
  loader: async ({ params }) => {
    const { threads } = await queryClient.ensureQueryData({
      queryKey: mailQueryKey,
      queryFn: fetchMailQuery,
    })
    const url = decodeURIComponent(params.threadUrl)
    if (!threads.some((t) => t.url === url)) {
      throw redirect({ to: '/' })
    }
  },
  component: DetailRouteComponent,
})

export const debugRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/debug',
  component: DebugLogPage,
})

const routeTree = rootRoute.addChildren([indexRoute, detailRoute, debugRoute])

// A factory rather than exporting one fixed instance: tests need their own
// router with a specific starting location (e.g. straight into
// /detail/$threadUrl) without disturbing the app's singleton below.
export function createAppRouter(initialEntries: string[] = ['/']) {
  return createRouter({
    routeTree,
    // Memory history, not browser/hash history: this is a popup window, not
    // a navigable page with a URL bar - there's nothing for browser history
    // to reflect, and no reason to round-trip navigation through it.
    history: createMemoryHistory({ initialEntries }),
  })
}

export const router = createAppRouter()

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
