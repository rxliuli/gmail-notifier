import { Hono } from 'hono'
import { auth } from './routes/auth'
import { billing } from './routes/billing'
import { gcp } from './routes/gcp'

const app = new Hono<{ Bindings: Env }>()

app.route('/', auth).route('/', billing).route('/', gcp)

app.all('*', async (c) => {
  if (c.env.APP_ENV === 'development') {
    const url = c.req.url.replace('http://localhost:8787', 'http://localhost:5173')
    return fetch(new Request(url, c.req))
  }
  return c.env.ASSETS.fetch(c.req.raw)
})

export default app
