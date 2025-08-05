import { Hono } from 'hono'
import { dbMiddleware } from '../middlewares/db'
import { Paddle, EventName, Environment, EventEntity } from '@paddle/paddle-node-sdk'
import { Subscription } from '../db/schema'
import z from 'zod'
import { ulid } from 'ulidx'
import { eq } from 'drizzle-orm'

const billing = new Hono<{ Bindings: Env }>().use(dbMiddleware())

const sandboxIPs = [
  '34.194.127.46',
  '54.234.237.108',
  '3.208.120.145',
  '44.226.236.210',
  '44.241.183.62',
  '100.20.172.113',
]
const liveIPs = ['34.232.58.13', '34.195.105.136', '34.237.3.244', '35.155.119.135', '52.11.166.252', '34.212.5.7']

// https://developer.paddle.com/build/guides/checkout/webhooks/events
billing.post('/api/v1/billing/webhook', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('x-real-ip')
  if (!ip) {
    return c.json({ error: 'IP not found' }, 400)
  }
  if (c.env.APP_ENV !== 'development') {
    console.log('ip', ip)
    const ips = c.env.PADDLE_ENVIRONMENT === 'sandbox' ? sandboxIPs : liveIPs
    if (!ips.includes(ip)) {
      return c.json({ error: 'IP not allowed' }, 403)
    }
  }
  const signature = c.req.header('Paddle-Signature')
  if (!signature) {
    return c.json({ error: 'Signature not found' }, 400)
  }
  if (!c.env.PADDEL_API_KEY || !c.env.PADDLE_ENVIRONMENT || !c.env.PADDEL_WEBHOOK_SECRET_KEY) {
    return c.text('Environment variables not set', 500)
  }
  const paddle = new Paddle(c.env.PADDEL_API_KEY, {
    environment: c.env.PADDLE_ENVIRONMENT as Environment,
  })
  const rawRequestBody = await c.req.text()
  const secretKey = c.env.PADDEL_WEBHOOK_SECRET_KEY
  if (!signature || !rawRequestBody) {
    return c.text('Signature missing in header', 400)
  }
  let eventData: EventEntity
  try {
    // The `unmarshal` function will validate the integrity of the webhook and return an entity
    eventData = await paddle.webhooks.unmarshal(rawRequestBody, secretKey, signature)
  } catch (e) {
    // Handle signature mismatch or other runtime errors
    console.log(e)
    return c.text('Signature mismatch', 400)
  }
  const db = c.get('db')

  if (eventData.eventType === EventName.SubscriptionCreated) {
    const customData = eventData.data.customData
    if (!customData || !('userId' in customData) || typeof customData.userId !== 'string') {
      console.log('Invalid custom data', customData)
      return c.text('Invalid custom data', 400)
    }
    const subscription = await db
      .select()
      .from(Subscription)
      .where(eq(Subscription.userId, customData.userId))
      .limit(1)
      .get()
    if (!subscription) {
      console.log('Subscription not found', customData.userId)
      return c.text('Subscription not found', 400)
    }
    await db
      .update(Subscription)
      .set({
        userId: customData.userId,
        customerId: eventData.data.customerId,
        status: 'active',
        plan: 'pro',
        currentPeriodEnd: eventData.data.nextBilledAt!,
        paddleSubscriptionId: eventData.data.id,
        paddleTransactionId: eventData.data.transactionId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(Subscription.id, subscription.id))
    console.log('Subscription created', eventData.data)
    return c.text('Subscription created')
  } else if (eventData.eventType === EventName.SubscriptionUpdated) {
    const subscription = await db
      .select()
      .from(Subscription)
      .where(eq(Subscription.customerId, eventData.data.customerId))
      .limit(1)
      .get()
    if (!subscription) {
      console.log('Subscription not found', eventData.data)
      return c.text('Subscription not found', 400)
    }
    const status = eventData.data.status
    await db
      .update(Subscription)
      .set({
        status: status === 'active' ? 'active' : status === 'paused' || status === 'canceled' ? 'canceled' : 'expired',
        currentPeriodEnd: eventData.data.nextBilledAt ?? subscription.currentPeriodEnd,
      })
      .where(eq(Subscription.id, subscription.id))
    console.log('Subscription updated', eventData.data)
    return c.text('Subscription updated')
  }
  return c.text('Processed webhook event')
})

export { billing }
