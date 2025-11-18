import ReactDOM from 'react-dom/client'
import App from './App.js'
import './style.css'

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(<App />)

// Send a periodic heartbeat to keep the port open.
const serviceWorkerConnection = browser.runtime.connect({
  name: 'popup',
})
setInterval(() => {
  serviceWorkerConnection.postMessage('heartbeat')
}, 15000)
