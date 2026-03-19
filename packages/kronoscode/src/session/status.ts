import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { Instance } from "@/project/instance"
import z from "zod"

export namespace SessionStatus {
  const RunHealth = z.object({
    status: z.enum(["healthy", "degraded", "error"]),
    confidence: z.number().optional(),
    recoverable: z.boolean().optional(),
    suggested_next_action: z.string().optional(),
    source: z.string().optional(),
    latency_ms: z.number().optional(),
  })

  const RuntimeInfo = z.object({
    activeTool: z.string().optional(),
    workType: z.string().optional(),
    runtimeTarget: z.string().optional(),
    runHealth: RunHealth.optional(),
  })

  export const Info = z
    .union([
      z.object({
        type: z.literal("idle"),
      }).merge(RuntimeInfo),
      z.object({
        type: z.literal("retry"),
        attempt: z.number(),
        message: z.string(),
        next: z.number(),
      }).merge(RuntimeInfo),
      z.object({
        type: z.literal("busy"),
      }).merge(RuntimeInfo),
    ])
    .meta({
      ref: "SessionStatus",
    })
  export type Info = z.infer<typeof Info>

  export const Event = {
    Status: BusEvent.define(
      "session.status",
      z.object({
        sessionID: z.string(),
        status: Info,
      }),
    ),
    // deprecated
    Idle: BusEvent.define(
      "session.idle",
      z.object({
        sessionID: z.string(),
      }),
    ),
  }

  const state = Instance.state(() => {
    const data: Record<string, Info> = {}
    return data
  })

  export function get(sessionID: string) {
    return (
      state()[sessionID] ?? {
        type: "idle",
      }
    )
  }

  export function list() {
    return state()
  }

  export function set(sessionID: string, status: Info) {
    Bus.publish(Event.Status, {
      sessionID,
      status,
    })
    if (status.type === "idle") {
      // deprecated
      Bus.publish(Event.Idle, {
        sessionID,
      })
      delete state()[sessionID]
      return
    }
    state()[sessionID] = status
  }
}
