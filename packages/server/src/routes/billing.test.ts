import { afterEach, describe, expect, it, vi } from 'vitest'
import { initCloudflareTest } from '../test/utils'
import created from './assets/webhook-created.json'
import cancel from './assets/webhook-cancel.json'
import { MeResponse } from './auth'
import { Subscription } from '../db/schema'
import { eq } from 'drizzle-orm'
import responseCancel from './assets/response-cancel.json'
import responseSubscriptionInNormal from './assets/response-subscription-in-normal.json'
import responseSubscriptionInCancel from './assets/response-subscription-in-cancel.json'
import responseUpdateScheduledChange from './assets/response-update-scheduled_change.json'

const c = initCloudflareTest()
async function getMe() {
  const resp = await c.fetch('/api/v1/auth/me', {
    headers: {
      Authorization: `Bearer ${c.token1}`,
    },
  })
  expect(resp.status).toBe(200)
  return (await resp.json()) as MeResponse
}
describe('webhook', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('create subscription success', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url !== `https://sandbox-api.paddle.com/notifications/${created.data.payload.notification_id}`) {
        throw new Error('Invalid URL')
      }
      created.data.payload.data.custom_data.userId = 'test-user-1'
      return Response.json(created)
    })

    expect(await getMe()).toMatchObject({
      id: 'test-user-1',
      status: 'trialing',
    } as MeResponse)
    const resp = await c.fetch('/api/v1/billing/webhook', {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '127.0.0.1',
        'Paddle-Signature': '1234567890',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notification_id: created.data.payload.notification_id,
        event_id: created.data.payload.event_id,
        event_type: created.data.payload.event_type,
        occurred_at: created.data.payload.occurred_at,
      }),
    })
    expect(resp.ok).true
    expect(await getMe()).toMatchObject({
      id: 'test-user-1',
      status: 'active',
    } as MeResponse)
  })

  it('cancel subscription success', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url !== `https://sandbox-api.paddle.com/notifications/${cancel.data.payload.notification_id}`) {
        throw new Error('Invalid URL')
      }
      cancel.data.payload.data.custom_data.userId = 'test-user-1'
      return Response.json(cancel)
    })
    await c.db
      .update(Subscription)
      .set({
        status: 'active',
      })
      .where(eq(Subscription.id, 'test-user-1'))
    const resp = await c.fetch('/api/v1/billing/webhook', {
      method: 'POST',
      headers: {
        'CF-Connecting-IP': '127.0.0.1',
        'Paddle-Signature': '1234567890',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        notification_id: cancel.data.payload.notification_id,
        event_id: cancel.data.payload.event_id,
        event_type: cancel.data.payload.event_type,
        occurred_at: cancel.data.payload.occurred_at,
      }),
    })
    expect(resp.ok).true
    expect(await getMe()).toMatchObject({
      id: 'test-user-1',
      status: 'canceled',
    } as MeResponse)
  })
})
describe('cancel subscription', async () => {
  it('cancel subscription success', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url === 'https://sandbox-api.paddle.com/subscriptions/sub_1234567890?') {
        return Response.json(responseSubscriptionInNormal)
      }
      if (url === 'https://sandbox-api.paddle.com/subscriptions/sub_1234567890/cancel') {
        return Response.json(responseCancel)
      }
      throw new Error('Invalid URL')
    })
    await c.db
      .update(Subscription)
      .set({
        status: 'active',
        paddleSubscriptionId: 'sub_1234567890',
      })
      .where(eq(Subscription.userId, 'test-user-1'))
    const resp = await c.fetch('/api/v1/billing/cancel', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.token1}`,
      },
    })
    expect(resp.status).toBe(200)
    expect(await getMe()).toMatchObject({
      id: 'test-user-1',
      status: 'canceled',
    } as MeResponse)
  })
  it('cancel subscription failed - no subscription', async () => {
    const resp = await c.fetch('/api/v1/billing/cancel', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.token1}`,
      },
    })
    expect(resp.status).toBe(404)
    const r = await resp.json()
    expect(r).toMatchObject({
      error: 'Subscription is not active',
    })
    expect(await getMe()).toMatchObject({
      id: 'test-user-1',
      status: 'trialing',
    } as MeResponse)
  })
  it('cancel subscription failed - already canceled', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url === 'https://sandbox-api.paddle.com/subscriptions/sub_1234567890?') {
        return Response.json(responseSubscriptionInCancel)
      }
      throw new Error('Invalid URL')
    })
    await c.db
      .update(Subscription)
      .set({
        status: 'canceled',
        paddleSubscriptionId: 'sub_1234567890',
      })
      .where(eq(Subscription.userId, 'test-user-1'))
    const resp = await c.fetch('/api/v1/billing/cancel', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.token1}`,
      },
    })
    expect(resp.status).eq(404)
    const r = await resp.json()
    expect(r).toMatchObject({
      error: 'Subscription is not active',
    })
  })
  it('cancel subscription failed - already canceled and status error', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (url === 'https://sandbox-api.paddle.com/subscriptions/sub_1234567890?') {
        return Response.json(responseSubscriptionInCancel)
      }
      throw new Error('Invalid URL')
    })
    await c.db
      .update(Subscription)
      .set({
        status: 'active',
        paddleSubscriptionId: 'sub_1234567890',
      })
      .where(eq(Subscription.userId, 'test-user-1'))
    const resp = await c.fetch('/api/v1/billing/cancel', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.token1}`,
      },
    })

    expect(resp.status).eq(400)
    const r = await resp.json()
    expect(r).toMatchObject({
      error: 'Subscription is scheduled to be canceled',
    })
  })
})
describe('resume subscription', async () => {
  it('resume subscription success', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (
        url === 'https://sandbox-api.paddle.com/subscriptions/sub_1234567890?' &&
        (!options?.method || options?.method === 'GET')
      ) {
        return Response.json(responseSubscriptionInCancel)
      }
      if (url === 'https://sandbox-api.paddle.com/subscriptions/sub_1234567890' && options?.method === 'PATCH') {
        return Response.json(responseUpdateScheduledChange)
      }
      throw new Error('Invalid URL')
    })
    await c.db
      .update(Subscription)
      .set({
        status: 'canceled',
        paddleSubscriptionId: 'sub_1234567890',
      })
      .where(eq(Subscription.userId, 'test-user-1'))
    const resp = await c.fetch('/api/v1/billing/reactivate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.token1}`,
      },
    })
    expect(resp.status).eq(200)
    expect(await getMe()).toMatchObject({
      id: 'test-user-1',
      status: 'active',
    } as MeResponse)
  })
  it('resume subscription failed - no subscription', async () => {
    const resp = await c.fetch('/api/v1/billing/reactivate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.token1}`,
      },
    })
    expect(resp.status).eq(404)
    const r = await resp.json()
    expect(r).toMatchObject({
      error: 'Subscription is not canceled',
    })
  })
  it('resume subscription failed - active', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (
        url === 'https://sandbox-api.paddle.com/subscriptions/sub_1234567890?' &&
        (!options?.method || options?.method === 'GET')
      ) {
        return Response.json(responseSubscriptionInNormal)
      }
      if (url === 'https://sandbox-api.paddle.com/subscriptions/sub_1234567890' && options?.method === 'PATCH') {
        return Response.json(responseUpdateScheduledChange)
      }
      throw new Error('Invalid URL')
    })
    await c.db
      .update(Subscription)
      .set({
        status: 'active',
        paddleSubscriptionId: 'sub_1234567890',
      })
      .where(eq(Subscription.userId, 'test-user-1'))
    const resp = await c.fetch('/api/v1/billing/reactivate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.token1}`,
      },
    })
    expect(resp.status).eq(404)
    const r = await resp.json()
    expect(r).toMatchObject({
      error: 'Subscription is not canceled',
    })
  })
  it('resume subscription failed - expired', async () => {
    await c.db
      .update(Subscription)
      .set({
        status: 'canceled',
        paddleSubscriptionId: 'sub_1234567890',
        currentPeriodEnd: new Date().toISOString(),
      })
      .where(eq(Subscription.userId, 'test-user-1'))
    const resp = await c.fetch('/api/v1/billing/reactivate', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.token1}`,
      },
    })
    expect(resp.status).eq(400)
    const r = await resp.json()
    expect(r).toMatchObject({
      error: 'Subscription is expired',
    })
  })
})
