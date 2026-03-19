import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { WorkflowRun } from "@/workflow/run"
import { lazy } from "@/util/lazy"
import { errors } from "../error"

export const WorkflowRoutes = lazy(() =>
  new Hono()
    .get(
      "/playbook",
      describeRoute({
        summary: "List workflow playbooks",
        description: "List available workflow playbooks for run orchestration.",
        operationId: "workflow.playbook.list",
        responses: {
          200: {
            description: "Workflow playbooks",
            content: {
              "application/json": {
                schema: resolver(WorkflowRun.Playbook.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        const playbooks = await WorkflowRun.listPlaybooks()
        return c.json(playbooks)
      },
    )
    .get(
      "/run",
      describeRoute({
        summary: "List workflow runs",
        description: "List workflow runs with persisted node execution state.",
        operationId: "workflow.run.list",
        responses: {
          200: {
            description: "Workflow runs",
            content: {
              "application/json": {
                schema: resolver(WorkflowRun.Info.array()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "query",
        z.object({
          sessionID: z.string().optional(),
          limit: z.coerce.number().optional(),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const runs = await WorkflowRun.list({
          sessionID: query.sessionID,
          limit: query.limit,
        })
        return c.json(runs)
      },
    )
    .get(
      "/run/active",
      describeRoute({
        summary: "List active workflow runs",
        description: "List active (queued/running) workflow runs for a session or globally.",
        operationId: "workflow.run.active",
        responses: {
          200: {
            description: "Active workflow runs",
            content: {
              "application/json": {
                schema: resolver(WorkflowRun.Active.array()),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "query",
        z.object({
          sessionID: z.string().optional(),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        const runs = await WorkflowRun.listActive({ sessionID: query.sessionID })
        return c.json(runs)
      },
    )
    .get(
      "/run/:runID",
      describeRoute({
        summary: "Get workflow run",
        description: "Get a workflow run and its node-level execution state.",
        operationId: "workflow.run.get",
        responses: {
          200: {
            description: "Workflow run",
            content: {
              "application/json": {
                schema: resolver(WorkflowRun.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          runID: z.string(),
        }),
      ),
      async (c) => {
        const run = await WorkflowRun.get(c.req.valid("param").runID)
        return c.json(run)
      },
    )
    .post(
      "/run",
      describeRoute({
        summary: "Start workflow run",
        description: "Start a workflow run for a session using a pre-defined playbook.",
        operationId: "workflow.run.start",
        responses: {
          200: {
            description: "Started workflow run",
            content: {
              "application/json": {
                schema: resolver(WorkflowRun.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("json", WorkflowRun.start.schema),
      async (c) => {
        const run = await WorkflowRun.start(c.req.valid("json"))
        return c.json(run)
      },
    )
    .post(
      "/run/:runID/cancel",
      describeRoute({
        summary: "Cancel workflow run",
        description: "Cancel an active workflow run.",
        operationId: "workflow.run.cancel",
        responses: {
          200: {
            description: "Cancelled workflow run",
            content: {
              "application/json": {
                schema: resolver(WorkflowRun.Info),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          runID: z.string(),
        }),
      ),
      async (c) => {
        const run = await WorkflowRun.cancel({ workflowRunID: c.req.valid("param").runID })
        return c.json(run)
      },
    ),
)
