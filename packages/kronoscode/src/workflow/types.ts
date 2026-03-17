import { z } from "zod"

export enum WorkflowNodeType {
  TASK = "task",
  CONDITION = "condition",
  TRANSFORM = "transform",
  AGENT = "agent",
  MULTI_AGENT = "multi_agent",
  DATA_SOURCE = "data_source",
  COLLECTION = "collection",
  RECORD = "record",
  NOTIFICATION = "notification",
  EMAIL = "email",
  WEBHOOK = "webhook",
  APPROVAL = "approval",
  WAIT = "wait",
  DELAY = "delay",
  AI_EMPLOYEE = "ai_employee",
  AI_DECISION = "ai_decision",
}

export enum WorkflowNodeStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  WAITING = "waiting",
  SKIPPED = "skipped",
}

export const WorkflowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
  condition: z.string().optional(),
  label: z.string().optional(),
})

export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>

export const WorkflowNodeConfigSchema = z.object({
  task: z
    .object({
      prompt: z.string(),
      model: z.string().optional(),
      temperature: z.number().optional(),
      maxTokens: z.number().optional(),
    })
    .optional(),

  condition: z
    .object({
      expression: z.string(),
      operator: z.enum(["equals", "notEquals", "contains", "greaterThan", "lessThan", "and", "or", "not"]),
      value: z.any(),
    })
    .optional(),

  transform: z
    .object({
      expression: z.string(),
      outputType: z.string().optional(),
    })
    .optional(),

  agent: z
    .object({
      agentId: z.string(),
      role: z.string(),
      skills: z.array(z.string()).optional(),
      budget: z.number().optional(),
      maxDuration: z.number().optional(),
    })
    .optional(),

  multiAgent: z
    .object({
      agents: z.array(
        z.object({
          agentId: z.string(),
          role: z.string(),
          percentage: z.number().optional(),
        }),
      ),
      coordination: z.enum(["sequential", "parallel", "debate", "consensus"]),
    })
    .optional(),

  dataSource: z
    .object({
      type: z.enum(["postgresql", "mysql", "mongodb", "rest", "graphql"]),
      connectionString: z.string(),
      query: z.string().optional(),
    })
    .optional(),

  approval: z
    .object({
      approverRoles: z.array(z.string()),
      timeout: z.number().optional(),
      requiredApprovals: z.number().optional(),
      autoApproveRoles: z.array(z.string()).optional(),
    })
    .optional(),

  wait: z
    .object({
      duration: z.number(),
      resumeCondition: z.string().optional(),
    })
    .optional(),

  notification: z
    .object({
      channels: z.array(z.enum(["email", "sms", "in_app", "webhook"])),
      template: z.string(),
      recipients: z.array(z.string()),
    })
    .optional(),

  aiEmployee: z
    .object({
      employeeId: z.string(),
      role: z.string(),
      capabilities: z.array(z.string()),
      autonomous: z.boolean().optional(),
    })
    .optional(),

  aiDecision: z
    .object({
      prompt: z.string(),
      options: z.array(z.string()),
      reasoningRequired: z.boolean().optional(),
    })
    .optional(),
})

export type WorkflowNodeConfig = z.infer<typeof WorkflowNodeConfigSchema>

export const WorkflowNodeSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(WorkflowNodeType),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: WorkflowNodeConfigSchema,
  label: z.string().optional(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
  onFailure: z.enum(["continue", "retry", "abort", "fallback"]).optional(),
  retryCount: z.number().optional(),
  timeout: z.number().optional(),
})

export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>

export const WorkflowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version: z.number().default(1),
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
  variables: z.record(z.string(), z.any()).optional(),
  triggers: z
    .array(
      z.object({
        type: z.enum(["manual", "scheduled", "event", "webhook"]),
        config: z.record(z.string(), z.any()),
      }),
    )
    .optional(),
  settings: z
    .object({
      timeout: z.number().optional(),
      retryPolicy: z
        .object({
          maxRetries: z.number(),
          backoff: z.enum(["none", "linear", "exponential"]),
          initialDelay: z.number().optional(),
        })
        .optional(),
      concurrency: z.number().optional(),
    })
    .optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  createdBy: z.string().optional(),
  status: z.enum(["draft", "active", "paused", "archived"]).optional(),
})

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>

export const WorkflowExecutionSchema = z.object({
  id: z.string(),
  workflowId: z.string(),
  status: z.nativeEnum(WorkflowNodeStatus),
  triggeredBy: z.string().optional(),
  input: z.record(z.string(), z.any()).optional(),
  output: z.record(z.string(), z.any()).optional(),
  nodes: z
    .record(
      z.string(),
      z.object({
        status: z.nativeEnum(WorkflowNodeStatus),
        input: z.any().optional(),
        output: z.any().optional(),
        error: z.string().optional(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
      }),
    )
    .optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export type WorkflowExecution = z.infer<typeof WorkflowExecutionSchema>

export interface WorkflowResult {
  success: boolean
  output?: Record<string, any>
  nodeOutputs: Map<string, any>
  errors: string[]
  executionTime: number
}

export enum WorkflowTriggerType {
  MANUAL = "manual",
  SCHEDULED = "scheduled",
  EVENT = "event",
  WEBHOOK = "webhook",
}

export interface WorkflowSchedule {
  cron?: string
  timezone?: string
  startDate?: Date
  endDate?: Date
  interval?: number
}

export interface WorkflowEventTrigger {
  eventType: string
  filter?: Record<string, any>
}

export interface WorkflowWebhookTrigger {
  path: string
  method: "GET" | "POST" | "PUT" | "PATCH"
  auth?: {
    type: "none" | "bearer" | "basic" | "api_key"
    config?: Record<string, string>
  }
}

export interface WorkflowTrigger {
  type: WorkflowTriggerType
  schedule?: WorkflowSchedule
  event?: WorkflowEventTrigger
  webhook?: WorkflowWebhookTrigger
  config?: Record<string, any>
}

export const WorkflowTables = {
  workflows: "workflows",
  executions: "workflow_executions",
  nodes: "workflow_nodes",
  edges: "workflow_edges",
  schedules: "workflow_schedules",
}

export default {
  WorkflowNodeType,
  WorkflowNodeStatus,
  WorkflowTriggerType,
}
