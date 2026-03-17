import type { ApprovalRequest, Role, User, AuditLog } from "./types.js"
import { ApprovalStatus, ApprovalType } from "./types.js"
import { Log } from "../util/log.js"

export class GovernanceEngine {
  private approvalRequests: Map<string, ApprovalRequest> = new Map()
  private roles: Map<string, Role> = new Map()
  private users: Map<string, User> = new Map()
  private auditLogs: Map<string, AuditLog> = new Map()

  constructor() {
    this.initializeDefaultRoles()
    Log.Default.info("GovernanceEngine initialized")
  }

  private initializeDefaultRoles(): void {
    const defaultRoles: Role[] = [
      {
        id: "admin",
        name: "Administrator",
        description: "Full system access",
        permissions: ["*"],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "manager",
        name: "Manager",
        description: "Manage teams and approve requests",
        permissions: ["approve:*", "manage:team", "view:reports"],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "developer",
        name: "Developer",
        description: "Can create and run tasks",
        permissions: ["create:task", "run:workflow", "view:own"],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "viewer",
        name: "Viewer",
        description: "Read-only access",
        permissions: ["view:read"],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    for (const role of defaultRoles) {
      this.roles.set(role.id, role)
    }
  }

  createApprovalRequest(request: ApprovalRequest): ApprovalRequest {
    const now = new Date()
    request.createdAt = now
    request.updatedAt = now

    if (request.timeout) {
      request.expiresAt = new Date(now.getTime() + request.timeout * 1000)
    }

    this.approvalRequests.set(request.id, request)
    this.logAudit({
      id: `audit_${Date.now()}`,
      entityType: "approval_request",
      entityId: request.id,
      action: "created",
      userId: request.requesterId,
      companyId: request.data?.companyId as string | undefined,
      createdAt: now,
    })

    Log.Default.info("Approval request created", { id: request.id, type: request.type, title: request.title })
    return request
  }

  async approve(requestId: string, approverId: string, comment?: string): Promise<boolean> {
    const request = this.approvalRequests.get(requestId)
    if (!request) {
      Log.Default.error("Approval request not found", { requestId })
      return false
    }

    if (request.status !== ApprovalStatus.PENDING) {
      Log.Default.warn("Approval request not pending", { requestId, status: request.status })
      return false
    }

    if (request.expiresAt && new Date() > request.expiresAt) {
      request.status = ApprovalStatus.EXPIRED
      Log.Default.warn("Approval request expired", { requestId })
      return false
    }

    request.approvedBy = request.approvedBy || []
    if (!request.approvedBy.includes(approverId)) {
      request.approvedBy.push(approverId)
    }

    request.updatedAt = new Date()

    if (request.approvedBy.length >= request.requiredApprovals) {
      request.status = ApprovalStatus.APPROVED
      Log.Default.info("Approval request approved", { requestId, approvedBy: approverId })
    }

    this.logAudit({
      id: `audit_${Date.now()}`,
      entityType: "approval_request",
      entityId: requestId,
      action: "approved",
      userId: approverId,
      changes: { comment },
      createdAt: new Date(),
    })

    return true
  }

  async reject(requestId: string, rejecterId: string, reason: string): Promise<boolean> {
    const request = this.approvalRequests.get(requestId)
    if (!request) {
      Log.Default.error("Approval request not found", { requestId })
      return false
    }

    request.status = ApprovalStatus.REJECTED
    request.updatedAt = new Date()

    this.logAudit({
      id: `audit_${Date.now()}`,
      entityType: "approval_request",
      entityId: requestId,
      action: "rejected",
      userId: rejecterId,
      changes: { reason },
      createdAt: new Date(),
    })

    Log.Default.info("Approval request rejected", { requestId, rejecterId, reason })
    return true
  }

  cancel(requestId: string, userId: string): boolean {
    const request = this.approvalRequests.get(requestId)
    if (!request) return false

    request.status = ApprovalStatus.CANCELLED
    request.updatedAt = new Date()

    this.logAudit({
      id: `audit_${Date.now()}`,
      entityType: "approval_request",
      entityId: requestId,
      action: "cancelled",
      userId,
      createdAt: new Date(),
    })

    return true
  }

  private logAudit(log: AuditLog): void {
    this.auditLogs.set(log.id, log)
  }

  registerRole(role: Role): void {
    this.roles.set(role.id, role)
    Log.Default.info("Role registered", { id: role.id, name: role.name })
  }

  registerUser(user: User): void {
    this.users.set(user.id, user)
    Log.Default.info("User registered", { id: user.id, name: user.name })
  }

  hasPermission(userId: string, permission: string): boolean {
    const user = this.users.get(userId)
    if (!user) return false

    for (const roleId of user.roles) {
      const role = this.roles.get(roleId)
      if (!role) continue

      if (role.permissions.includes("*")) return true

      const [action, resource] = permission.split(":")
      if (role.permissions.includes(permission)) return true
      if (role.permissions.includes(`${action}:*`)) return true
    }

    return false
  }

  getApprovalRequest(id: string): ApprovalRequest | undefined {
    return this.approvalRequests.get(id)
  }

  getRole(id: string): Role | undefined {
    return this.roles.get(id)
  }

  getUser(id: string): User | undefined {
    return this.users.get(id)
  }

  listApprovalRequests(status?: ApprovalStatus, companyId?: string): ApprovalRequest[] {
    let requests = Array.from(this.approvalRequests.values())
    if (status) requests = requests.filter((r) => r.status === status)
    if (companyId) requests = requests.filter((r) => r.data?.companyId === companyId)
    return requests
  }

  listRoles(): Role[] {
    return Array.from(this.roles.values())
  }

  listUsers(companyId?: string): User[] {
    let users = Array.from(this.users.values())
    if (companyId) users = users.filter((u) => u.companyId === companyId)
    return users
  }

  listAuditLogs(entityType?: string, entityId?: string, companyId?: string): AuditLog[] {
    let logs = Array.from(this.auditLogs.values())
    if (entityType) logs = logs.filter((l) => l.entityType === entityType)
    if (entityId) logs = logs.filter((l) => l.entityId === entityId)
    if (companyId) logs = logs.filter((l) => l.companyId === companyId)
    return logs.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
  }

  canApprove(userId: string, request: ApprovalRequest): boolean {
    const user = this.users.get(userId)
    if (!user) return false

    if (request.autoApproveRoles) {
      for (const roleId of user.roles) {
        if (request.autoApproveRoles.includes(roleId)) return true
      }
    }

    return user.roles.some((r) => request.approverRoles.includes(r))
  }
}

export default GovernanceEngine
