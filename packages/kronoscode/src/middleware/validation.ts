import type { NextFunction, Request, Response } from "express"
import { z } from "zod"
import type { ZodSchema } from "zod"
import { Log } from "@/util/log"

const log = Log.create({ service: "validation" })

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body) as Request["body"]
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        log.warn("Request validation failed", {
          path: req.path,
          errors: error.issues,
          userId: req.user?.id,
          orgId: req.user?.orgId,
        })
        return res.status(400).json({
          error: "Validation failed",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        })
      }
      next(error)
    }
  }
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = schema.parse(req.query) as Request["query"]
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        log.warn("Query validation failed", {
          path: req.path,
          errors: error.issues,
          userId: req.user?.id,
          orgId: req.user?.orgId,
        })
        return res.status(400).json({
          error: "Invalid query parameters",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        })
      }
      next(error)
    }
  }
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params) as Request["params"]
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        log.warn("Params validation failed", {
          path: req.path,
          errors: error.issues,
          userId: req.user?.id,
          orgId: req.user?.orgId,
        })
        return res.status(400).json({
          error: "Invalid parameters",
          details: error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        })
      }
      next(error)
    }
  }
}

// Common validation schemas
export const CommonSchemas = {
  uuid: z.string().uuid(),
  orgScopedId: z.string().min(1).max(255),
  paginationQuery: z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
  }),
  searchQuery: z.object({
    query: z.string().max(255).optional(),
    category: z.string().max(50).optional(),
  }),
}
