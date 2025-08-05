import { Hono } from 'hono'
import { jwtAuthMiddleware } from '../middlewares/auth'
import { dbMiddleware } from '../middlewares/db'
import { User } from '../db/schema'
import { eq } from 'drizzle-orm'

const gcp = new Hono<{ Bindings: Env }>().use(jwtAuthMiddleware()).use(dbMiddleware())

async function getAccessToken(refreshToken: string, env: Env) {
  return fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
}

export type AccessTokenResponse = {
  accessToken: string
  expiresAt: string
}

gcp.get('/api/v1/gcp/access-token', async (c) => {
  const payload = c.get('jwtPayload')
  const db = c.get('db')
  const dbUser = await db.select().from(User).where(eq(User.id, payload.userId)).get()
  if (!dbUser) {
    return c.json({ error: 'User not found' }, 404)
  }
  if (dbUser.refreshTokenExpiresAt && new Date(dbUser.refreshTokenExpiresAt) < new Date()) {
    return c.json({ error: 'Refresh token expired' }, 401)
  }
  const resp = await getAccessToken(dbUser.refreshToken, c.env)
  if (!resp.ok) {
    console.error('Get access token failed', resp)
    return c.json({ error: 'Get access token failed' }, 401)
  }
  const res = (await resp.json()) as { access_token: string; expires_in: number }
  return c.json({
    accessToken: res.access_token,
    expiresAt: new Date(Date.now() + res.expires_in * 1000).toISOString(),
  })
})

export { gcp }
