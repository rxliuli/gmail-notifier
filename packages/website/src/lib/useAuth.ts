import type { MeResponse } from '@gmail-notifier/server'
import { useState } from 'react'

type LocalUser = {
  token: string
} & MeResponse

export function useLocalUser() {
  const [user, setUser] = useState<LocalUser | null>(typeof localStorage !== 'undefined' ? getLocalUser() : null)
  return {
    user,
    login: () => {
      const search = new URLSearchParams(location.search)
      let href = '/api/v1/auth/google'
      if (search.get('prompt')) {
        href += '?prompt=' + search.get('prompt')
      }
      location.href = href
    },
    logout: async () => {
      localStorage.removeItem('user')
      setUser(null)
      if (user) {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        })
      }
      location.href = '/'
    },
  }
}

export function getLocalUser() {
  return localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null
}
