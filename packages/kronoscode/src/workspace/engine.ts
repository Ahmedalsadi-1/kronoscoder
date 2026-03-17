import type { Workspace, WorkspaceUser, WorkspaceInvite } from "./types.js"
import { WorkspaceStatus } from "./types.js"
import { Log } from "../util/log.js"
import crypto from "crypto"

export class WorkspaceEngine {
  private workspaces: Map<string, Workspace> = new Map()
  private workspaceUsers: Map<string, WorkspaceUser> = new Map()
  private workspaceInvites: Map<string, WorkspaceInvite> = new Map()
  private currentWorkspace: string | null = null

  constructor() {
    Log.Default.info("WorkspaceEngine initialized")
  }

  createWorkspace(workspace: Workspace): Workspace {
    workspace.createdAt = new Date()
    workspace.updatedAt = new Date()
    this.workspaces.set(workspace.id, workspace)

    Log.Default.info("Workspace created", { id: workspace.id, name: workspace.name })
    return workspace
  }

  updateWorkspace(id: string, updates: Partial<Workspace>): Workspace | undefined {
    const workspace = this.workspaces.get(id)
    if (!workspace) return undefined

    Object.assign(workspace, updates, { updatedAt: new Date() })
    Log.Default.info("Workspace updated", { id })
    return workspace
  }

  archiveWorkspace(id: string): boolean {
    const workspace = this.workspaces.get(id)
    if (!workspace) return false

    workspace.status = WorkspaceStatus.ARCHIVED
    workspace.updatedAt = new Date()
    Log.Default.info("Workspace archived", { id })
    return true
  }

  suspendWorkspace(id: string): boolean {
    const workspace = this.workspaces.get(id)
    if (!workspace) return false

    workspace.status = WorkspaceStatus.SUSPENDED
    workspace.updatedAt = new Date()
    Log.Default.info("Workspace suspended", { id })
    return true
  }

  addUser(workspaceUser: WorkspaceUser): void {
    const key = `${workspaceUser.workspaceId}:${workspaceUser.userId}`
    workspaceUser.createdAt = new Date()
    this.workspaceUsers.set(key, workspaceUser)
    Log.Default.info("User added to workspace", {
      workspaceId: workspaceUser.workspaceId,
      userId: workspaceUser.userId,
      role: workspaceUser.role,
    })
  }

  removeUser(workspaceId: string, userId: string): boolean {
    const key = `${workspaceId}:${userId}`
    const removed = this.workspaceUsers.delete(key)
    if (removed) {
      Log.Default.info("User removed from workspace", { workspaceId, userId })
    }
    return removed
  }

  createInvite(invite: WorkspaceInvite): WorkspaceInvite {
    invite.token = crypto.randomBytes(32).toString("hex")
    invite.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    invite.createdAt = new Date()
    this.workspaceInvites.set(invite.id, invite)

    Log.Default.info("Workspace invite created", {
      id: invite.id,
      workspaceId: invite.workspaceId,
      email: invite.email,
    })
    return invite
  }

  acceptInvite(token: string): WorkspaceUser | null {
    const invite = Array.from(this.workspaceInvites.values()).find((i) => i.token === token)
    if (!invite) {
      Log.Default.warn("Invite not found", { token })
      return null
    }

    if (invite.expiresAt < new Date()) {
      invite.status = "expired"
      Log.Default.warn("Invite expired", { token })
      return null
    }

    invite.status = "accepted"

    const workspaceUser: WorkspaceUser = {
      workspaceId: invite.workspaceId,
      userId: invite.invitedBy,
      role: invite.role,
      createdAt: new Date(),
    }

    this.addUser(workspaceUser)
    Log.Default.info("Invite accepted", { token })
    return workspaceUser
  }

  setCurrentWorkspace(workspaceId: string): boolean {
    const workspace = this.workspaces.get(workspaceId)
    if (!workspace) {
      Log.Default.error("Workspace not found", { workspaceId })
      return false
    }

    if (workspace.status !== WorkspaceStatus.ACTIVE) {
      Log.Default.error("Workspace not active", { workspaceId, status: workspace.status })
      return false
    }

    this.currentWorkspace = workspaceId
    Log.Default.info("Current workspace set", { workspaceId })
    return true
  }

  getCurrentWorkspace(): Workspace | null {
    if (!this.currentWorkspace) return null
    return this.workspaces.get(this.currentWorkspace) || null
  }

  isInWorkspace(userId: string, workspaceId: string): boolean {
    const key = `${workspaceId}:${userId}`
    return this.workspaceUsers.has(key)
  }

  hasPermission(userId: string, workspaceId: string, permission: string): boolean {
    const key = `${workspaceId}:${userId}`
    const workspaceUser = this.workspaceUsers.get(key)
    if (!workspaceUser) return false

    if (workspaceUser.role === "owner") return true
    if (workspaceUser.role === "admin" && permission !== "delete") return true
    if (workspaceUser.permissions?.includes(permission)) return true

    return false
  }

  getWorkspace(id: string): Workspace | undefined {
    return this.workspaces.get(id)
  }

  getUserWorkspaces(userId: string): Workspace[] {
    const userWorkspaces = Array.from(this.workspaceUsers.values())
      .filter((wu) => wu.userId === userId)
      .map((wu) => this.workspaces.get(wu.workspaceId))
      .filter((w): w is Workspace => w !== undefined)

    return userWorkspaces
  }

  listWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values())
  }

  listWorkspaceUsers(workspaceId: string): WorkspaceUser[] {
    return Array.from(this.workspaceUsers.values()).filter((wu) => wu.workspaceId === workspaceId)
  }

  getWorkspaceInvites(workspaceId: string): WorkspaceInvite[] {
    return Array.from(this.workspaceInvites.values()).filter((wi) => wi.workspaceId === workspaceId)
  }
}

export default WorkspaceEngine
