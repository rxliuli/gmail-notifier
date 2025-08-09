import { createFileRoute } from '@tanstack/react-router'
import { getLocalUser, useLocalUser } from '~/lib/useAuth'
import { useMount } from '@/utils/useMount'
import { MeResponse } from '@gmail-notifier/server'
import { toast } from 'sonner'

export const Route = createFileRoute('/login')({
  component: Login,
})

function Login() {
  const { login, user } = useLocalUser()
  useMount(async () => {
    const params = new URLSearchParams(location.search)
    const from = params.get('from')
    if (from !== 'plugin') {
      sessionStorage.removeItem('from')
      return
    }
    console.log('login from plugin')
    sessionStorage.setItem('from', 'plugin')
    if (!user) {
      return
    }
    const resp = await fetch('/api/v1/auth/me', {
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    })
    if (!resp.ok) {
      return
    }
    const data = { ...user, ...((await resp.json()) as MeResponse) }
    localStorage.setItem('user', JSON.stringify(data))
    document.dispatchEvent(new CustomEvent('LoginSuccess', { detail: { user: data } }))
    toast.success('Login success, auto close window...')
    await new Promise((resolve) => setTimeout(resolve, 1000))
    window.close()
  })
  return (
    <div className="min-h-[80vh] flex flex-col justify-center max-w-md mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Welcome to Gmail Notifier</h1>
        <p className="text-muted-foreground">Sign in with your Google account to start receiving Gmail notifications</p>
      </div>

      <div className="space-y-6">
        <button
          onClick={login}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 border border-gray-300 px-6 py-3 rounded-lg font-medium hover:bg-gray-50"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        <p className="text-center text-sm text-muted-foreground">
          By continuing, you agree to our{' '}
          <a href="/terms" className="underline hover:text-foreground">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  )
}
