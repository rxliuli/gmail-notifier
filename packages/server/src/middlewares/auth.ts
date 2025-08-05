import { MiddlewareHandler } from 'hono'
import { jwt } from 'hono/jwt'

export function jwtAuthMiddleware(): MiddlewareHandler<{ Bindings: Env }> {
  return (c, next) => {
    const jwtMiddleware = jwt({ secret: c.env.JWT_SECRET })
    return jwtMiddleware(c, next)
  }
}
