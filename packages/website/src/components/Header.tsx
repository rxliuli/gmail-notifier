import { MeResponse } from '@gmail-notifier/server'
import { useQuery } from '@tanstack/react-query'
import { ClientOnly, Link } from '@tanstack/react-router'
import { CreditCard, Settings, Mail, Loader2 } from 'lucide-react'
import { getLocalUser } from '~/lib/useAuth'

function AuthInfo() {
  const query = useQuery({
    queryKey: ['user'],
    retry: false,
    queryFn: async () => {
      const localUser = getLocalUser()
      if (!localUser) {
        return null
      }
      const resp = await fetch('/api/v1/auth/me', {
        headers: {
          Authorization: `Bearer ${localUser.token}`,
        },
      })
      if (!resp.ok) {
        localStorage.removeItem('user')
        return null
      }
      const data = (await resp.json()) as MeResponse
      localStorage.setItem('user', JSON.stringify({ ...localUser, ...data }))
      return data
    },
  })
  if (query.isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin" />
  }
  return query.data?.email ? (
    <Link to="/settings" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
      <Settings className="h-4 w-4" />
      <span>Account</span>
    </Link>
  ) : (
    <Link to="/login" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
      <Mail className="h-4 w-4" />
      <span>Login</span>
    </Link>
  )
}

export function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4">
        <nav className="flex items-center justify-between">
          <Link to="/" className="text-xl font-bold">
            Gmail Notifier
          </Link>
          <div className="flex items-center space-x-6">
            <Link to="/pricing" className="flex items-center space-x-2 text-muted-foreground hover:text-foreground">
              <CreditCard className="h-4 w-4" />
              <span>Pricing</span>
            </Link>
            <ClientOnly fallback={<Loader2 className="h-4 w-4 animate-spin" />}>
              <AuthInfo />
            </ClientOnly>
          </div>
        </nav>
      </div>
    </header>
  )
}
