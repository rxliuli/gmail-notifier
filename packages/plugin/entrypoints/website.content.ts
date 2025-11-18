// This content script is no longer needed as we removed the login system
// Browser extension can access Gmail directly through cookies
const matches = ['https://gmail-notifier.rxliuli.com/*']
if (import.meta.env.DEV) {
  matches.push('http://localhost/*')
}
export default defineContentScript({
  matches,
  main: () => {
    const meta = document.createElement('meta')
    meta.name = 'gmail-notifier'
    document.head.appendChild(meta)
  },
})
