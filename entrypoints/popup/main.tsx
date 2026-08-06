import ReactDOM from 'react-dom/client'
import App from './App.js'
import './style.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(<App />)

// Send a periodic heartbeat to keep the service worker alive. Some browsers
// (seen on Safari) can tear down the service worker - and this port with it -
// while the popup is still open, so reconnect instead of leaving the
// interval throwing on a dead port forever.
function connectToServiceWorker() {
  const port = browser.runtime.connect({ name: 'popup' })
  port.onDisconnect.addListener(() => {
    serviceWorkerConnection = connectToServiceWorker()
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
