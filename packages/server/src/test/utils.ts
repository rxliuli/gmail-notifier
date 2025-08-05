import { afterEach, beforeEach, vi } from 'vitest'
import { createExecutionContext, env } from 'cloudflare:test'
import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1'
import app from '..'
import { sign } from 'hono/jwt'
import { Account, Subscription, User } from '../db/schema'

export interface CloudflareTestContext {
  ctx: ExecutionContext
  fetch: typeof app.request
  token1: string
  token2: string
  env: Env
  db: DrizzleD1Database
}

export async function createCloudflareTestContext(): Promise<CloudflareTestContext> {
  const _env = env as Env
  const token1 = await sign({ userId: 'test-user-1' }, _env.JWT_SECRET)
  const token2 = await sign({ userId: 'test-user-2' }, _env.JWT_SECRET)
  await _env.DB.prepare(_env.TEST_INIT_SQL).run()
  const db = drizzle(_env.DB)
  await db.batch([
    db.insert(User).values({
      id: 'test-user-1',
      email: '1@test.com',
      name: 'test-user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      refreshToken: 'test-refresh-token',
      refreshTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    }),
    db.insert(User).values({
      id: 'test-user-2',
      email: '2@test.com',
      name: 'test-user-2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      refreshToken: 'test-refresh-token',
      refreshTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    }),
    db.insert(Subscription).values({
      id: 'test-subscription-1',
      userId: 'test-user-1',
      status: 'trialing',
      currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    db.insert(Subscription).values({
      id: 'test-subscription-2',
      userId: 'test-user-2',
      status: 'trialing',
      currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    db.insert(Account).values({
      id: 'test-account-1',
      providerId: 'google',
      providerAccountId: 'test-user-1',
      userId: 'test-user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    db.insert(Account).values({
      id: 'test-account-2',
      providerId: 'google',
      providerAccountId: 'test-user-2',
      userId: 'test-user-2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  ])
  const ctx = createExecutionContext()
  const fetch = ((url: string, options: RequestInit) => app.request(url, options, env, ctx)) as typeof app.request
  return {
    ctx,
    fetch,
    token1,
    token2,
    env: _env,
    db,
  }
}

export function initCloudflareTest(): CloudflareTestContext {
  let context: CloudflareTestContext
  beforeEach(async () => {
    context = await createCloudflareTestContext()
    vi.spyOn(globalThis, 'fetch').mockImplementation(context.fetch as any)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  return {
    get ctx() {
      return context.ctx
    },
    get fetch() {
      return context.fetch
    },
    get env() {
      return context.env
    },
    get token1() {
      return context.token1
    },
    get token2() {
      return context.token2
    },
    get db() {
      return context.db
    },
  }
}
