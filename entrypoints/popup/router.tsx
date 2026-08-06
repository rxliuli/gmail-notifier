import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect } from 'react'
import { IndexPage } from './pages/IndexPage'
import { DetailPage } from './pages/DetailPage'
import { DebugLogPage } from './pages/DebugLogPage'

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
export const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/detail/$threadUrl',
  component: DetailPage,
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
