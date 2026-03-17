import { z } from "zod"

export enum ApprovalStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

export enum ApprovalType {
  TASK = "task",
  WORKFLOW = "workflow",
  AGENT_HIRE = "agent_hire",
  BUDGET = "budget",
  CONFIG_CHANGE = "config_change",
  TERMINATE = "terminate",
  CUSTOM = "custom",
}

export const ApprovalRequestSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(ApprovalType),
  title: z.string(),
  description: z.string().optional(),
  requesterId: z.string(),
  targetId: z.string(),
  targetType: z.string(),
  data: z.record(z.string(), z.any()).optional(),
  requiredApprovals: z.number().default(1),
  approvedBy: z.array(z.string()).optional(),
  status: z.nativeEnum(ApprovalStatus).default(ApprovalStatus.PENDING),
  approverRoles: z.array(z.string()),
  autoApproveRoles: z.array(z.string()).optional(),
  timeout: z.number().optional(),
  expiresAt: z.date().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>

export const RoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  permissions: z.array(z.string()),
  inheritsFrom: z.string().optional(),
  companyId: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export type Role = z.infer<typeof RoleSchema>

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  companyId: z.string().optional(),
  roles: z.array(z.string()),
  status: z.enum(["active", "inactive", "suspended"]).default("active"),
  metadata: z.record(z.string(), z.any()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export type User = z.infer<typeof UserSchema>

export const AuditLogSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  action: z.string(),
  userId: z.string(),
  companyId: z.string().optional(),
  changes: z.record(z.string(), z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  createdAt: z.date().optional(),
})

export type AuditLog = z.infer<typeof AuditLogSchema>

export const GovernanceTables = {
  approvalRequests: "governance_approval_requests",
  roles: "governance_roles",
  users: "governance_users",
  auditLogs: "governance_audit_logs",
}
