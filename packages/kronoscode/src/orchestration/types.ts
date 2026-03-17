import { z } from "zod"

export enum AgentStatus {
  IDLE = "idle",
  ACTIVE = "active",
  RUNNING = "running",
  WAITING = "waiting",
  PAUSED = "paused",
  STOPPED = "stopped",
  ERROR = "error",
}

export enum AgentType {
  CODE = "code",
  RESEARCH = "research",
  DESIGN = "design",
  MARKETING = "marketing",
  SUPPORT = "support",
  CUSTOM = "custom",
}

export enum AgentProvider {
  CLAUDE = "claude",
  OPENAI = "openai",
  GEMINI = "gemini",
  GROK = "grok",
  OPENCLAW = "openclaw",
  CODEX = "codex",
  CUSTOM = "custom",
}

export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.nativeEnum(AgentType),
  provider: z.nativeEnum(AgentProvider),
  role: z.string(),
  description: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  skills: z.array(z.string()).optional(),
  status: z.nativeEnum(AgentStatus).default(AgentStatus.IDLE),
  budget: z
    .object({
      monthlyLimit: z.number(),
      spent: z.number().default(0),
      currency: z.string().default("USD"),
    })
    .optional(),
  maxDuration: z.number().optional(),
  config: z.record(z.string(), z.any()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export type Agent = z.infer<typeof AgentSchema>

export const OrgChartNodeSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  title: z.string(),
  parentId: z.string().optional(),
  reports: z.array(z.string()).optional(),
  level: z.number().default(0),
  permissions: z.array(z.string()).optional(),
})

export type OrgChartNode = z.infer<typeof OrgChartNodeSchema>

export const GoalSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  parentId: z.string().optional(),
  companyId: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  status: z.enum(["active", "completed", "cancelled", "on_hold"]).default("active"),
  progress: z.number().min(0).max(100).default(0),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export type Goal = z.infer<typeof GoalSchema>

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  goalId: z.string().optional(),
  companyId: z.string().optional(),
  assigneeId: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled", "blocked"]).default("pending"),
  priority: z.enum(["urgent", "high", "medium", "low"]).default("medium"),
  input: z.record(z.string(), z.any()).optional(),
  output: z.record(z.string(), z.any()).optional(),
  error: z.string().optional(),
  cost: z.number().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export type Task = z.infer<typeof TaskSchema>

export const HeartbeatSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  schedule: z.string(),
  timezone: z.string().default("UTC"),
  enabled: z.boolean().default(true),
  lastRun: z.date().optional(),
  nextRun: z.date().optional(),
  config: z.record(z.string(), z.any()).optional(),
})

export type Heartbeat = z.infer<typeof HeartbeatSchema>

export const CompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  settings: z.record(z.string(), z.any()).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

export type Company = z.infer<typeof CompanySchema>

export const BudgetAlertSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  threshold: z.number(),
  currentSpend: z.number(),
  period: z.enum(["daily", "weekly", "monthly"]),
  triggered: z.boolean().default(false),
  triggeredAt: z.date().optional(),
})

export type BudgetAlert = z.infer<typeof BudgetAlertSchema>

export const OrchestrationTables = {
  agents: "orchestration_agents",
  orgChart: "orchestration_org_chart",
  goals: "orchestration_goals",
  tasks: "orchestration_tasks",
  heartbeats: "orchestration_heartbeats",
  companies: "orchestration_companies",
  budgetAlerts: "orchestration_budget_alerts",
}
