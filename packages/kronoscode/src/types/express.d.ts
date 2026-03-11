import type { Auth0User } from "@/auth/auth0"

declare global {
  namespace Express {
    interface Request {
      user?: Auth0User
    }
  }
}

export {}
