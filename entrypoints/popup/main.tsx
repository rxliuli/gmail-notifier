import ReactDOM from 'react-dom/client'
import App from './App.js'
import './style.css'
import { debugLog } from '@/lib/debugLog'

// Root cause of a whole cluster of Safari-only extension-popup bugs, found
// the hard way over one long debugging session (each looked unrelated until
// they didn't):
//   - No elastic/momentum scroll physics on scrollable content (unlike a
//     normal Safari tab or the Chrome popup, both fine)
//   - prefers-color-scheme sometimes not detected - popup rendered light
//     while the exact same build, same OS appearance, rendered dark in a
//     normal tab
//   - The tab behind the popup, blurred, briefly visible THROUGH the popup
//     (Safari's native vibrancy/blur-behind material showing through
//     wherever nothing opaque had painted over it yet)
//   - Scroll position not resetting when navigating between routes -
//     confirmed live via DevTools that documentElement.scrollTop simply
//     stayed at its old value after a route change
//
// All four traced back to the same trigger: the popup's native window
// auto-resizing to match content height as it changes (switching routes,
// long email threads, etc). WebKit's own Safari 26.2 changelog
// (https://webkit.org/blog/17640/webkit-features-for-safari-26-2/) even
// acknowledges "extension popups could open scrolled down and some
// websites could flicker during scrolling" as a real, only-recently-fixed
// bug class here - this isn't a one-off, it's a known rough edge in how
// Safari's popup WKWebView synchronizes its native window with content.
//
// The fix - confirmed live, all four symptoms gone - is to never let the
// window resize at all: pin it to one fixed size up front, before React
// renders anything, so every route fits inside the same frame regardless of
// its own content height. See style.css's `.safari-fixed-popup` rule for
// the actual dimensions - body scrolls directly there (not a nested
// overflow-auto div per page), which is also what restores proper
// elastic/momentum physics: that's document-level scroll, the same kind a
// normal tab gets, not the nested-div scroll that was one of the four
// symptoms above.
//
// Chrome/Firefox don't have Safari's whole bug cluster from auto-resizing,
// so the full fixed-size treatment below is scoped to Safari only. They
// still auto-size the popup horizontally to fit content, though - a long
// unbroken subject line or email address can widen it unexpectedly - so
// they get a width-only fix instead. See style.css's `.safari-fixed-popup`
// and `.fixed-width-popup` rules for the actual dimensions.
//
// Neither should ever apply to the "Popout" link's standalone tab (see
// IndexPage) - a real tab has no reason to be size-constrained the way the
// actual toolbar popup does, so that link marks itself with ?view=tab and
// both branches below skip if it's set.
//
// Set as early as possible, before the first paint, so Safari never sees an
// unpinned frame even for a moment.
const isPopoutTab = new URLSearchParams(location.search).get('view') === 'tab'
if (!isPopoutTab) {
  if (import.meta.env.SAFARI) {
    document.documentElement.classList.add('safari-fixed-popup')
  } else {
    document.documentElement.classList.add('fixed-width-popup')
  }
}

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(<App />)

// Send a periodic heartbeat to keep the service worker alive. Some browsers
// (seen on Safari) can tear down the service worker - and this port with it -
// while the popup is still open, so reconnect instead of leaving the
// interval throwing on a dead port forever.
//
// The reconnect is deliberately delayed rather than immediate: on Safari the
// port can disconnect instantly (before the service worker has a chance to
// do anything), and reconnecting synchronously turned this into a tight
// connect/disconnect loop that appeared to be starving the service worker of
// any window to actually run - hundreds of connects/sec, zero completed
// fetches. A gap between attempts matters more here than fast recovery.
const RECONNECT_DELAY_MS = 2000

function connectToServiceWorker() {
  const port = browser.runtime.connect({ name: 'popup' })
  port.onDisconnect.addListener(async () => {
    await debugLog('popup: service worker port disconnected, reconnecting in', RECONNECT_DELAY_MS, 'ms')
    setTimeout(() => {
      serviceWorkerConnection = connectToServiceWorker()
    }, RECONNECT_DELAY_MS)
  })
  return port
}
let serviceWorkerConnection = connectToServiceWorker()
setInterval(() => {
  try {
    serviceWorkerConnection.postMessage('heartbeat')
  } catch (err) {
    console.error('heartbeat failed', err)
  }
}, 15000)
