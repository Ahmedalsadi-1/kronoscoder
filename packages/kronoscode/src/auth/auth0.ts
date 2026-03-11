import type { Context, Next } from "hono"
import jwt from "jsonwebtoken"
import jwksClient from "jwks-rsa"
import { z } from "zod"
import { Log } from "@/util/log"

const log = Log.create({ service: "auth0" })

const Auth0Claims = z.object({
  sub: z.string(),
  email: z.string().email(),
  "https://kronoscode.ai/org_id": z.string(),
  "https://kronoscode.ai/role": z.enum(["owner", "admin", "operator", "member", "auditor"]),
  iss: z.string(),
  aud: z.string(),
  exp: z.number(),
  iat: z.number(),
})

export type Auth0User = {
  id: string
  email: string
  orgId: string
  role: "owner" | "admin" | "operator" | "member" | "auditor"
}

const client = jwksClient({
  jwksUri: `${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
})

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err)
    const signingKey = key?.getPublicKey()
    callback(null, signingKey)
  })
}

export function requireAuth(requiredRoles?: Array<Auth0User["role"]>) {
  return async (c: Context, next: Next) => {
    try {
      const authHeader = c.req.header("authorization")
      if (!authHeader?.startsWith("Bearer ")) {
        return c.json({ error: "Missing or invalid authorization header" }, 401)
      }

      const token = authHeader.slice(7)
      
      const decoded = await new Promise<any>((resolve, reject) => {
        jwt.verify(token, getKey, {
          audience: process.env.AUTH0_AUDIENCE,
          issuer: process.env.AUTH0_DOMAIN,
          algorithms: ["RS256"]
        }, (err, decoded) => {
          if (err) reject(err)
          else resolve(decoded)
        })
      })

      const claims = Auth0Claims.parse(decoded)
      
      const user: Auth0User = {
        id: claims.sub,
        email: claims.email,
        orgId: claims["https://kronoscode.ai/org_id"],
        role: claims["https://kronoscode.ai/role"]
      }

      // Check role permissions
      if (requiredRoles && !requiredRoles.includes(user.role)) {
        return c.json({ error: "Insufficient permissions" }, 403)
      }

      // Attach user to request context
      ;(c.req as any).user = user
      
      await next()
    } catch (error) {
      log.error("Auth verification failed", { error })
      return c.json({ error: "Invalid token" }, 401)
    }
  }
}

export function requireRole(...roles: Array<Auth0User["role"]>) {
  return requireAuth(roles)
}
