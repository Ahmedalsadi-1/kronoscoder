import { Database } from "./db"
export { Database, NotFoundError } from "./db"
export * from "./storage"
export * from "./schema"
export * from "./schema.sql"
export * from "./json-migration"

// Convenience export for backward compatibility
// Use Database.use((db) => ...) for proper database access pattern
export const db = Database.Client()
