import { beforeEach, describe, expect, it, Mock, vi } from 'vitest'
import { initCloudflareTest } from '../test/utils'
import { User } from '../db/schema'
import { googleAuthCallback, MeResponse } from './auth'
import { Context } from 'hono'
import { pick } from 'es-toolkit'
import { GoogleUser } from '@hono/oauth-providers/google'

const c = initCloudflareTest()

describe('login', () => {
  let redirect: Mock
  let get: Mock<Context['get']>
  let context: Pick<Context<{ Bindings: Env }>, 'env' | 'redirect' | 'get'>
  beforeEach(() => {
    redirect = vi.fn().mockImplementation(
      (url) =>
        new Response(null, {
          status: 302,
          headers: { Location: url },
        }),
    )
    get = vi.fn()
    context = {
      redirect,
      env: c.env,
      get,
    }
  })
  const googleUser = {
    id: 'test-user-1',
    email: '1@test.com',
    name: 'test-user-1',
    picture: 'https://example.com/picture.png',
  } as GoogleUser
  const refreshToken = {
    token: 'test-refresh-token',
    expires_in: 1000 * 60 * 60 * 24 * 30,
  }
  const grantedScopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'openid',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/gmail.send',
  ]
  it('google login', async () => {
    const resp = await fetch('/api/v1/auth/google')
    expect(resp.status).toBe(302)
    expect(resp.headers.get('Location')).contain('https://accounts.google.com')
  })
  it('new user', async () => {
    expect(await c.db.$count(User)).eq(2)
    get.mockImplementation((key) => {
      if (key === 'user-google') return { ...googleUser, id: 'test-user-3', email: '3@test.com' }
      if (key === 'refresh-token') return refreshToken
      if (key === 'granted-scopes') return grantedScopes
    })
    const resp = await googleAuthCallback(context)
    expect(resp.status).toBe(302)
    const url = new URL(resp.headers.get('Location')!)
    expect(url.searchParams.get('user')).not.undefined
    expect(await c.db.$count(User)).eq(3)
  })
  it('existing user', async () => {
    expect(await c.db.$count(User)).eq(2)
    get.mockImplementation((key) => {
      if (key === 'user-google') return googleUser
      if (key === 'refresh-token') return refreshToken
      if (key === 'granted-scopes') return grantedScopes
    })
    const resp = await googleAuthCallback(context)
    const url = new URL(resp.headers.get('Location')!)
    const user = url.searchParams.get('user')
    expect(user).not.undefined
    const userData = JSON.parse(user!) as MeResponse
    expect(userData.token).not.undefined
    expect(userData.status).eq('trialing')
    expect(await c.db.$count(User)).eq(2)
  })
  it('refresh token is not required in existing user', async () => {
    get.mockImplementation((key) => {
      if (key === 'user-google') return googleUser
      if (key === 'granted-scopes') return grantedScopes
    })
    const resp = await googleAuthCallback(context)
    const url = new URL(resp.headers.get('Location')!)
    expect(url.searchParams.get('user')).not.undefined
  })
  describe('login failed', () => {
    it('user cancel login', async () => {
      const resp = await googleAuthCallback(context)
      const url = new URL(resp.headers.get('Location')!)
      expect(url.searchParams.get('error')).eq('login_failed')
    })
    it('granted scopes is not enough', async () => {
      get.mockImplementation((key) => {
        if (key === 'user-google') return { ...googleUser, id: 'test-user-3', email: '3@test.com' }
        if (key === 'refresh-token') return refreshToken
        if (key === 'granted-scopes') return ['openid', 'email', 'profile']
      })
      const resp = await googleAuthCallback(context)
      const url = new URL(resp.headers.get('Location')!)
      expect(url.searchParams.get('error')).eq('granted_scopes_not_enough')
    })
    it('refresh token is required in new user', async () => {
      get.mockImplementation((key) => {
        if (key === 'user-google') return { ...googleUser, id: 'test-user-3', email: '3@test.com' }
        if (key === 'granted-scopes') return grantedScopes
      })
      const resp = await googleAuthCallback(context)
      const url = new URL(resp.headers.get('Location')!)
      expect(url.searchParams.get('error')).eq('refresh_token_not_found')
    })
  })
})

describe('get user info', () => {
  it('get user info', async () => {
    const resp = await fetch('/api/v1/auth/me', {
      headers: {
        Authorization: `Bearer ${c.token1}`,
      },
    })
    expect(resp.status).toBe(200)
    const r = (await resp.json()) as MeResponse
    expect(pick(r, ['id', 'email'])).toEqual({
      id: 'test-user-1',
      email: '1@test.com',
    })
  })

  it('get user info with invalid token', async () => {
    const resp = await fetch('/api/v1/auth/me', {
      headers: {
        Authorization: `Bearer invalid`,
      },
    })
    expect(resp.status).toBe(401)
  })
})

it.todo('resolve assets')
