import rateLimit from "express-rate-limit"
import RedisStore from "rate-limit-redis"
import Redis from "ioredis"
import type { Request } from "express"

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379")

const createLimiter = (windowMs: number, max: number, keyGenerator?: (req: Request) => string) => {
  return rateLimit({
    // `rate-limit-redis` types vary by version; runtime object is compatible.
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)),
    }) as any,
    windowMs,
    max,
    keyGenerator: keyGenerator || ((req) => req.ip || "unknown-ip"),
    message: { error: "Too many requests" },
    standardHeaders: true,
    legacyHeaders: false,
  })
}

// Per-IP limits
export const globalLimit = createLimiter(15 * 60 * 1000, 1000) // 1000 requests per 15 minutes per IP

// Per-user limits  
export const userLimit = createLimiter(
  15 * 60 * 1000, 
  500, 
  (req) => req.user?.id || req.ip || "unknown-ip"
) // 500 requests per 15 minutes per user

// Per-org limits for expensive operations
export const orgLimit = createLimiter(
  60 * 1000,
  50,
  (req) => req.user?.orgId || req.ip || "unknown-ip"
) // 50 requests per minute per org

// Specific operation limits
export const installLimit = createLimiter(
  60 * 1000,
  5,
  (req) => `install:${req.user?.orgId || req.ip || "unknown-ip"}`
) // 5 installs per minute per org

export const sessionLimit = createLimiter(
  60 * 1000,
  10,
  (req) => `session:${req.user?.orgId || req.ip || "unknown-ip"}`
) // 10 session operations per minute per org

export const toolInvocationLimit = createLimiter(
  60 * 1000,
  100,
  (req) => `tools:${req.user?.orgId || req.ip || "unknown-ip"}`
) // 100 tool invocations per minute per org
