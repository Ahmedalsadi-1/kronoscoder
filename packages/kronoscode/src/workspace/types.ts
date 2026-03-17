import { z } from "zod"

export enum WorkspaceStatus {
  ACTIVE = "active",
  SUSPENDED = "suspended",
  ARCHIVED = "archived",
}

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  status: z.nativeEnum(WorkspaceStatus).default(WorkspaceStatus.ACTIVE),
  settings: z.record(z.string(), z.any()).optional(),
  features: z.record(z.string(), z.boolean()).optional(),
  limits: z
    .object({
      agents: z.number().optional(),
      workflows: z.number().optional(),
      storage: z.number().optional(),
      users: z.number().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export type Workspace = z.infer<typeof WorkspaceSchema>

export const WorkspaceUserSchema = z.object({
  workspaceId: z.string(),
  userId: z.string(),
  role: z.enum(["owner", "admin", "member", "viewer"]),
  permissions: z.array(z.string()).optional(),
  createdAt: z.date().optional(),
})

export type WorkspaceUser = z.infer<typeof WorkspaceUserSchema>

export const WorkspaceInviteSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  email: z.string(),
  role: z.enum(["admin", "member", "viewer"]),
  invitedBy: z.string(),
  token: z.string(),
  expiresAt: z.date(),
  status: z.enum(["pending", "accepted", "expired"]).default("pending"),
  createdAt: z.date().optional(),
})

export type WorkspaceInvite = z.infer<typeof WorkspaceInviteSchema>

export const WorkspaceTables = {
  workspaces: "workspace_workspaces",
  workspaceUsers: "workspace_users",
  workspaceInvites: "workspace_invites",
}
