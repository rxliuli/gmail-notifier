import { Context, Hono } from 'hono'
import { googleAuth } from '@hono/oauth-providers/google'
import { sign } from 'hono/jwt'
import { drizzle } from 'drizzle-orm/d1'
import { Account, Subscription, User } from '../db/schema'
import { eq, InferSelectModel } from 'drizzle-orm'
import { ulid } from 'ulidx'
import dayjs from 'dayjs'
import { jwtAuthMiddleware } from '../middlewares/auth'

const auth = new Hono<{ Bindings: Env }>()

auth
  .use('/api/v1/auth/google', async (c, next) => {
    const baseUrl = c.env.APP_ENV === 'development' ? 'http://localhost:5173' : 'https://gmail-notifier.rxliuli.com'
    console.log('prompt', c.req.query('prompt'))
    return googleAuth({
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.metadata',
      ],
      redirect_uri: `${baseUrl}/api/v1/auth/google`,
      access_type: 'offline',
      prompt: c.req.query('prompt') === 'consent' ? 'consent' : undefined,
    })(c, next)
  })
  .get('/api/v1/auth/google', googleAuthCallback)

export async function googleAuthCallback(c: Pick<Context<{ Bindings: Env }>, 'env' | 'redirect' | 'get'>) {
  const baseUrl = c.env.APP_ENV === 'development' ? 'http://localhost:5173' : 'https://gmail-notifier.rxliuli.com'
  const googleUser = c.get('user-google')
  let refreshToken = c.get('refresh-token')
  const grantedScopes = c.get('granted-scopes')
  if (!googleUser?.id || !googleUser?.email) {
    return c.redirect(`${baseUrl}/logged?error=login_failed`)
  }
  if (
    !grantedScopes?.includes('https://www.googleapis.com/auth/gmail.send') ||
    !grantedScopes?.includes('https://www.googleapis.com/auth/gmail.metadata')
  ) {
    return c.redirect(`${baseUrl}/logged?error=granted_scopes_not_enough`)
  }

  const now = new Date().toISOString()
  const db = drizzle(c.env.DB)
  let dbUser = await db.select().from(User).where(eq(User.email, googleUser.email)).get()
  const userId = dbUser?.id ?? ulid()
  let currentPeriodEnd = dayjs().add(2, 'week').toISOString()
  let status: InferSelectModel<typeof Subscription>['status'] = 'trialing'
  if (!dbUser) {
    if (!refreshToken?.token) {
      return c.redirect(`${baseUrl}/logged?error=refresh_token_not_found`)
    }
    await db.batch([
      db.insert(User).values({
        id: userId,
        name: googleUser.name ?? '',
        email: googleUser.email,
        image: googleUser.picture,
        createdAt: now,
        updatedAt: now,
        refreshToken: refreshToken.token,
        refreshTokenExpiresAt: refreshToken.expires_in
          ? new Date(Date.now() + refreshToken.expires_in * 1000).toISOString()
          : null,
      }),
      db.insert(Account).values({
        id: ulid(),
        providerId: 'google',
        providerAccountId: googleUser.id,
        userId,
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(Subscription).values({
        id: ulid(),
        userId,
        status: 'trialing',
        currentPeriodEnd: currentPeriodEnd,
        createdAt: now,
        updatedAt: now,
      }),
    ])
  } else {
    const subscription = await db.select().from(Subscription).where(eq(Subscription.userId, userId)).get()
    if (!subscription) {
      return c.redirect(`${baseUrl}/logged?error=subscription_not_found`)
    }
    if (refreshToken?.token && refreshToken.expires_in) {
      await db
        .update(User)
        .set({
          refreshToken: refreshToken.token,
          refreshTokenExpiresAt: new Date(Date.now() + refreshToken.expires_in * 1000).toISOString(),
        })
        .where(eq(User.id, userId))
    }
    currentPeriodEnd = subscription.currentPeriodEnd
    status = subscription.status
  }

  const token = await sign({ userId, exp: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).getTime() }, c.env.JWT_SECRET)

  const user = await db.select().from(User).where(eq(User.id, userId)).get()
  if (!user) {
    return c.redirect(`${baseUrl}/logged?error=login_failed`)
  }
  const url = new URL(`${baseUrl}/logged`)
  url.searchParams.set(
    'user',
    JSON.stringify({
      id: userId,
      name: googleUser.name,
      email: googleUser.email,
      token,
      currentPeriodEnd,
      status,
    } satisfies MeResponse),
  )
  return c.redirect(url.toString())
}

export type MeResponse = {
  id: string
  email: string
  name?: string
  token?: string
} & Pick<InferSelectModel<typeof Subscription>, 'status' | 'currentPeriodEnd'>

auth.get('/api/v1/auth/me', jwtAuthMiddleware(), async (c) => {
  const payload = c.get('jwtPayload')
  const db = drizzle(c.env.DB)
  const dbUser = await db.select().from(User).where(eq(User.id, payload.userId)).get()
  const subscription = await db.select().from(Subscription).where(eq(Subscription.userId, payload.userId)).get()
  if (!dbUser || !subscription) {
    return c.json({ error: 'User not found' }, 404)
  }
  return c.json<MeResponse>({
    id: dbUser.id,
    email: dbUser.email,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
  })
})
auth.post('/api/v1/auth/logout', jwtAuthMiddleware(), async (c) => {
  return c.json({ ok: true })
})

export { auth }
