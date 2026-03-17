import type { Agent, OrgChartNode, Goal, Task, Heartbeat, Company, BudgetAlert } from "./types.js"
import { AgentStatus } from "./types.js"
import { Log } from "../util/log.js"

export class OrchestrationEngine {
  private agents: Map<string, Agent> = new Map()
  private orgChart: Map<string, OrgChartNode> = new Map()
  private goals: Map<string, Goal> = new Map()
  private tasks: Map<string, Task> = new Map()
  private heartbeats: Map<string, Heartbeat> = new Map()
  private companies: Map<string, Company> = new Map()
  private budgetAlerts: Map<string, BudgetAlert> = new Map()
  private taskCheckouts: Map<string, string> = new Map()

  constructor() {
    Log.Default.info("OrchestrationEngine initialized")
  }

  registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent)
    Log.Default.info("Agent registered", { id: agent.id, name: agent.name, role: agent.role })
  }

  registerCompany(company: Company): void {
    this.companies.set(company.id, company)
    Log.Default.info("Company registered", { id: company.id, name: company.name })
  }

  addToOrgChart(node: OrgChartNode): void {
    this.orgChart.set(node.id, node)
    Log.Default.info("Added to org chart", { id: node.id, title: node.title })
  }

  createGoal(goal: Goal): Goal {
    this.goals.set(goal.id, goal)
    Log.Default.info("Goal created", { id: goal.id, name: goal.name })
    return goal
  }

  updateGoalProgress(goalId: string, progress: number): void {
    const goal = this.goals.get(goalId)
    if (goal) {
      goal.progress = Math.min(100, Math.max(0, progress))
      if (goal.progress === 100) {
        goal.status = "completed"
      }
      Log.Default.info("Goal progress updated", { goalId, progress })
    }
  }

  async checkoutTask(taskId: string, agentId: string): Promise<boolean> {
    if (this.taskCheckouts.has(taskId)) {
      const currentAgent = this.taskCheckouts.get(taskId)
      if (currentAgent !== agentId) {
        Log.Default.warn("Task already checked out", { taskId, currentAgent, requestedBy: agentId })
        return false
      }
    }

    const agent = this.agents.get(agentId)
    if (!agent) {
      Log.Default.error("Agent not found", { agentId })
      return false
    }

    if (agent.budget) {
      if (agent.budget.spent >= agent.budget.monthlyLimit) {
        Log.Default.warn("Agent budget exceeded", {
          agentId,
          spent: agent.budget.spent,
          limit: agent.budget.monthlyLimit,
        })
        return false
      }
    }

    this.taskCheckouts.set(taskId, agentId)
    agent.status = AgentStatus.RUNNING

    Log.Default.info("Task checked out", { taskId, agentId })
    return true
  }

  releaseTask(taskId: string): void {
    const agentId = this.taskCheckouts.get(taskId)
    if (agentId) {
      const agent = this.agents.get(agentId)
      if (agent) {
        agent.status = AgentStatus.IDLE
      }
    }
    this.taskCheckouts.delete(taskId)
    Log.Default.info("Task released", { taskId })
  }

  async completeTask(taskId: string, output: Record<string, any>, cost: number): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) return

    const agentId = this.taskCheckouts.get(taskId)
    if (agentId) {
      const agent = this.agents.get(agentId)
      if (agent) {
        if (agent.budget) {
          agent.budget.spent += cost
          this.checkBudgetAlert(agent)
        }
        agent.status = AgentStatus.IDLE
      }
    }

    task.status = "completed"
    task.output = output
    task.cost = cost
    task.completedAt = new Date()
    this.taskCheckouts.delete(taskId)

    if (task.goalId) {
      this.updateGoalProgressFromTask(task.goalId)
    }

    Log.Default.info("Task completed", { taskId, cost })
  }

  private checkBudgetAlert(agent: Agent): void {
    if (!agent.budget) return

    const alertKey = `${agent.id}_monthly`
    let alert = this.budgetAlerts.get(alertKey)

    const threshold = agent.budget.monthlyLimit * 0.8
    if (agent.budget.spent >= threshold && !alert) {
      alert = {
        id: alertKey,
        agentId: agent.id,
        threshold,
        currentSpend: agent.budget.spent,
        period: "monthly",
        triggered: true,
        triggeredAt: new Date(),
      }
      this.budgetAlerts.set(alertKey, alert)
      Log.Default.warn("Budget alert triggered", { agentId: agent.id, threshold, spent: agent.budget.spent })
    }
  }

  private updateGoalProgressFromTask(goalId: string): void {
    const goal = this.goals.get(goalId)
    if (!goal) return

    const relatedTasks = Array.from(this.tasks.values()).filter((t) => t.goalId === goalId)
    if (relatedTasks.length === 0) return

    const completed = relatedTasks.filter((t) => t.status === "completed").length
    const progress = Math.round((completed / relatedTasks.length) * 100)

    goal.progress = progress
    if (progress === 100) {
      goal.status = "completed"
    }

    if (goal.parentId) {
      this.updateGoalProgressFromTask(goal.parentId)
    }
  }

  createTask(task: Task): Task {
    this.tasks.set(task.id, task)
    Log.Default.info("Task created", { id: task.id, title: task.title })
    return task
  }

  registerHeartbeat(heartbeat: Heartbeat): void {
    this.heartbeats.set(heartbeat.id, heartbeat)
    Log.Default.info("Heartbeat registered", { id: heartbeat.id, agentId: heartbeat.agentId })
  }

  getGoalAncestry(goalId: string): Goal[] {
    const ancestry: Goal[] = []
    let current = this.goals.get(goalId)

    while (current) {
      ancestry.unshift(current)
      if (current.parentId) {
        current = this.goals.get(current.parentId)
      } else {
        break
      }
    }

    return ancestry
  }

  getAgentOrgPosition(agentId: string): OrgChartNode | undefined {
    return Array.from(this.orgChart.values()).find((node) => node.agentId === agentId)
  }

  getSubordinates(agentId: string): Agent[] {
    const node = this.getAgentOrgPosition(agentId)
    if (!node) return []

    const subordinates: Agent[] = []
    for (const childId of node.reports || []) {
      const childNode = this.orgChart.get(childId)
      if (childNode) {
        const agent = this.agents.get(childNode.agentId)
        if (agent) subordinates.push(agent)
        subordinates.push(...this.getSubordinates(childNode.agentId))
      }
    }

    return subordinates
  }

  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId)
  }

  getCompany(companyId: string): Company | undefined {
    return this.companies.get(companyId)
  }

  getGoal(goalId: string): Goal | undefined {
    return this.goals.get(goalId)
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId)
  }

  listAgents(): Agent[] {
    return Array.from(this.agents.values())
  }

  listGoals(companyId?: string): Goal[] {
    if (companyId) {
      return Array.from(this.goals.values()).filter((g) => g.companyId === companyId)
    }
    return Array.from(this.goals.values())
  }

  listTasks(goalId?: string, companyId?: string): Task[] {
    let tasks = Array.from(this.tasks.values())
    if (goalId) tasks = tasks.filter((t) => t.goalId === goalId)
    if (companyId) tasks = tasks.filter((t) => t.companyId === companyId)
    return tasks
  }

  listCompanies(): Company[] {
    return Array.from(this.companies.values())
  }

  listBudgetAlerts(triggeredOnly = false): BudgetAlert[] {
    const alerts = Array.from(this.budgetAlerts.values())
    if (triggeredOnly) {
      return alerts.filter((a) => a.triggered)
    }
    return alerts
  }

  getOrgChart(): OrgChartNode[] {
    return Array.from(this.orgChart.values())
  }
}

export default OrchestrationEngine
