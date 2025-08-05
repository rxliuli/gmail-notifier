import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1'
import { createMiddleware } from 'hono/factory'

export function dbMiddleware() {
  return createMiddleware<{
    Bindings: Env
    Variables: {
      db: DrizzleD1Database
    }
  }>(async (c, next) => {
    if (c.get('db')) {
      return await next()
    }
    const db = drizzle(c.env.DB)
    c.set('db', db)
    await next()
  })
}
