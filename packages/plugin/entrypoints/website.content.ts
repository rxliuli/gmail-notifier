import { setUser } from '@/lib/auth'

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

    document.addEventListener('LoginSuccess', async (event) => {
      const { user } = (event as CustomEvent).detail
      await setUser(user)
    })
  },
})
