import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMount } from 'react-use'
import { toast } from 'sonner'

export const Route = createFileRoute('/logged')({
  component: () => {
    const navigate = useNavigate()
    useMount(async () => {
      const search = new URLSearchParams(location.search)
      const user = search.get('user')
      if (!user) {
        const error = search.get('error')
        if (error === 'login_failed') {
          alert('Login failed, please try again later')
          location.href = '/'
          return
        }
        if (error === 'granted_scopes_not_enough') {
          alert('Please grant the necessary permissions to use the extension')
          location.href = '/api/v1/auth/google?prompt=consent'
          return
        }
        if (error === 'refresh_token_not_found') {
          alert('Refresh token not found, please login again')
          location.href = '/api/v1/auth/google?prompt=consent'
          return
        }
        navigate({ to: '/login', search: { error: 'user_required' } })
        return
      }
      if (document.querySelector('meta[name="gmail-notifier"]') && sessionStorage.getItem('from') === 'plugin') {
        document.dispatchEvent(new CustomEvent('LoginSuccess', { detail: { user: JSON.parse(user) } }))
        sessionStorage.removeItem('from')
        toast.success('Login success, auto close window...')
        await new Promise((resolve) => setTimeout(resolve, 1000))
        window.close()
        return
      }
      localStorage.setItem('user', user)
      navigate({ to: '/settings' })
    })
    return <div>Loading...</div>
  },
})
