import type { WorkflowDefinition, WorkflowExecution, WorkflowResult, WorkflowNode } from "./types.js"
import { WorkflowNodeStatus, WorkflowNodeType } from "./types.js"
import { Log } from "../util/log.js"

export class WorkflowEngine {
  private workflows: Map<string, WorkflowDefinition> = new Map()
  private executions: Map<string, WorkflowExecution> = new Map()
  private nodeOutputs: Map<string, Record<string, any>> = new Map()

  constructor() {
    Log.Default.info("WorkflowEngine initialized")
  }

  registerWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow)
    Log.Default.info("Workflow registered", { id: workflow.id, name: workflow.name })
  }

  async execute(workflowId: string, input: Record<string, any>): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) {
      return {
        success: false,
        nodeOutputs: new Map(),
        errors: [`Workflow ${workflowId} not found`],
        executionTime: 0,
      }
    }

    const startTime = Date.now()
    const execution: WorkflowExecution = {
      id: `exec_${Date.now()}`,
      workflowId,
      status: WorkflowNodeStatus.RUNNING,
      input,
      nodes: {},
      startedAt: new Date(),
    }
    this.executions.set(execution.id, execution)

    const nodeOutputs = new Map<string, any>()
    nodeOutputs.set("input", input)
    this.nodeOutputs.set(execution.id, nodeOutputs)

    try {
      const sortedNodes = this.topologicalSort(workflow.nodes, workflow.edges)

      for (const node of sortedNodes) {
        if (node.disabled) continue

        const nodeResult = await this.executeNode(node, nodeOutputs, execution.id)
        nodeOutputs.set(node.id, nodeResult.output)

        execution.nodes![node.id] = {
          status: nodeResult.success ? WorkflowNodeStatus.COMPLETED : WorkflowNodeStatus.FAILED,
          input: nodeResult.input,
          output: nodeResult.output,
          error: nodeResult.error,
          startTime: nodeResult.startTime,
          endTime: nodeResult.endTime,
        }

        if (!nodeResult.success && node.onFailure === "abort") {
          throw new Error(`Node ${node.id} failed: ${nodeResult.error}`)
        }
      }

      execution.status = WorkflowNodeStatus.COMPLETED
      execution.completedAt = new Date()
      execution.output = Object.fromEntries(nodeOutputs)

      return {
        success: true,
        output: Object.fromEntries(nodeOutputs),
        nodeOutputs: new Map(nodeOutputs),
        errors: [],
        executionTime: Date.now() - startTime,
      }
    } catch (error) {
      execution.status = WorkflowNodeStatus.FAILED
      execution.completedAt = new Date()

      return {
        success: false,
        nodeOutputs,
        errors: [error instanceof Error ? error.message : String(error)],
        executionTime: Date.now() - startTime,
      }
    }
  }

  private async executeNode(
    node: WorkflowNode,
    previousOutputs: Map<string, any>,
    executionId: string,
  ): Promise<{
    success: boolean
    output: any
    input: any
    error?: string
    startTime: Date
    endTime: Date
  }> {
    const startTime = new Date()
    const context = Object.fromEntries(previousOutputs)

    try {
      let output: any

      switch (node.type) {
        case WorkflowNodeType.TASK:
          output = await this.executeTask(node, context)
          break
        case WorkflowNodeType.CONDITION:
          output = await this.executeCondition(node, context)
          break
        case WorkflowNodeType.TRANSFORM:
          output = await this.executeTransform(node, context)
          break
        case WorkflowNodeType.AGENT:
          output = await this.executeAgent(node, context)
          break
        case WorkflowNodeType.MULTI_AGENT:
          output = await this.executeMultiAgent(node, context)
          break
        case WorkflowNodeType.DELAY:
          output = await this.executeDelay(node, context)
          break
        case WorkflowNodeType.WAIT:
          output = await this.executeWait(node, context)
          break
        case WorkflowNodeType.APPROVAL:
          output = await this.executeApproval(node, context)
          break
        case WorkflowNodeType.AI_EMPLOYEE:
          output = await this.executeAIEmployee(node, context)
          break
        case WorkflowNodeType.AI_DECISION:
          output = await this.executeAIDecision(node, context)
          break
        case WorkflowNodeType.NOTIFICATION:
          output = await this.executeNotification(node, context)
          break
        case WorkflowNodeType.WEBHOOK:
          output = await this.executeWebhook(node, context)
          break
        default:
          output = { result: "unsupported node type" }
      }

      return {
        success: true,
        output,
        input: context,
        startTime,
        endTime: new Date(),
      }
    } catch (error) {
      return {
        success: false,
        output: null,
        input: context,
        error: error instanceof Error ? error.message : String(error),
        startTime,
        endTime: new Date(),
      }
    }
  }

  private async executeTask(node: WorkflowNode, context: any): Promise<any> {
    const config = node.data.task
    if (!config) return { result: "no task config" }

    return {
      task: "executed",
      prompt: config.prompt,
      model: config.model || "default",
    }
  }

  private async executeCondition(node: WorkflowNode, context: any): Promise<any> {
    const config = node.data.condition
    if (!config) return { result: "no condition config" }

    const value = this.resolveExpression(config.expression, context)
    let result = false

    switch (config.operator) {
      case "equals":
        result = value === config.value
        break
      case "notEquals":
        result = value !== config.value
        break
      case "contains":
        result = String(value).includes(String(config.value))
        break
      case "greaterThan":
        result = Number(value) > Number(config.value)
        break
      case "lessThan":
        result = Number(value) < Number(config.value)
        break
      case "and":
        result = Array.isArray(config.value) && config.value.every((v: any) => this.resolveExpression(v, context))
        break
      case "or":
        result = Array.isArray(config.value) && config.value.some((v: any) => this.resolveExpression(v, context))
        break
      case "not":
        result = !this.resolveExpression(config.value, context)
        break
    }

    return { condition: config.expression, result, path: result ? "true" : "false" }
  }

  private async executeTransform(node: WorkflowNode, context: any): Promise<any> {
    const config = node.data.transform
    if (!config) return { result: "no transform config" }

    return {
      transformed: this.resolveExpression(config.expression, context),
      original: context,
    }
  }

  private async executeAgent(node: WorkflowNode, context: any): Promise<any> {
    const config = node.data.agent
    if (!config) return { result: "no agent config" }

    return {
      agent: "executed",
      agentId: config.agentId,
      role: config.role,
      budget: config.budget,
    }
  }

  private async executeMultiAgent(node: WorkflowNode, context: any): Promise<any> {
    const config = node.data.multiAgent
    if (!config) return { result: "no multi-agent config" }

    const results = config.agents.map((agent) => ({
      agentId: agent.agentId,
      role: agent.role,
      percentage: agent.percentage || 100 / config.agents.length,
    }))

    return {
      coordination: config.coordination,
      agents: results,
    }
  }

  private async executeDelay(node: WorkflowNode, context: any): Promise<any> {
    const config = node.data.wait
    if (!config) return { delayed: 0 }

    await new Promise((resolve) => setTimeout(resolve, config.duration * 1000))
    return { delayed: config.duration }
  }

  private async executeWait(node: WorkflowNode, context: any): Promise<any> {
    return { waiting: true, condition: node.data.wait?.resumeCondition }
  }

  private async executeApproval(node: WorkflowNode, context: any): Promise<any> {
    const config = node.data.approval
    if (!config) return { approved: true }

    return {
      approval: "required",
      approverRoles: config.approverRoles,
      timeout: config.timeout,
    }
  }

  private async executeAIEmployee(node: WorkflowNode, context: any): Promise<any> {
    const config = node.data.aiEmployee
    if (!config) return { result: "no AI employee config" }

    return {
      employee: "assigned",
      employeeId: config.employeeId,
      role: config.role,
      autonomous: config.autonomous || false,
    }
  }

  private async executeAIDecision(node: WorkflowNode, context: any): Promise<any> {
    const config = node.data.aiDecision
    if (!config) return { result: "no AI decision config" }

    return {
      decision: "pending",
      prompt: config.prompt,
      options: config.options,
    }
  }

  private async executeNotification(node: WorkflowNode, context: any): Promise<any> {
    const config = node.data.notification
    if (!config) return { result: "no notification config" }

    return {
      notification: "sent",
      channels: config.channels,
      template: config.template,
    }
  }

  private async executeWebhook(node: WorkflowNode, context: any): Promise<any> {
    return { webhook: "called" }
  }

  private resolveExpression(expr: string, context: any): any {
    try {
      const keys = expr.match(/\${([^}]+)}/g) || []
      let result = expr
      for (const key of keys) {
        const path = key.slice(2, -1)
        const value = this.getNestedValue(context, path)
        result = result.replace(key, String(value))
      }
      return result
    } catch {
      return expr
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj)
  }

  private topologicalSort(nodes: WorkflowNode[], edges: any[]): WorkflowNode[] {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))
    const inDegree = new Map<string, number>()
    const adjacency = new Map<string, string[]>()

    for (const node of nodes) {
      inDegree.set(node.id, 0)
      adjacency.set(node.id, [])
    }

    for (const edge of edges) {
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
      adjacency.get(edge.source)?.push(edge.target)
    }

    const queue: string[] = []
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id)
    }

    const result: WorkflowNode[] = []
    while (queue.length > 0) {
      const current = queue.shift()!
      const node = nodeMap.get(current)
      if (node) result.push(node)

      for (const neighbor of adjacency.get(current) || []) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1
        inDegree.set(neighbor, newDegree)
        if (newDegree === 0) queue.push(neighbor)
      }
    }

    return result
  }

  getWorkflow(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id)
  }

  getExecution(id: string): WorkflowExecution | undefined {
    return this.executions.get(id)
  }

  listWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values())
  }

  listExecutions(workflowId?: string): WorkflowExecution[] {
    if (workflowId) {
      return Array.from(this.executions.values()).filter((e) => e.workflowId === workflowId)
    }
    return Array.from(this.executions.values())
  }
}

export default WorkflowEngine
