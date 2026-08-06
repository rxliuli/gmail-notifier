import ReactDOM from 'react-dom/client'
import App from './App.js'
import './style.css'
import { debugLog } from '@/lib/debugLog'

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
