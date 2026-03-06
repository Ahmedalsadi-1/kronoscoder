import z from "zod"
import { Tool } from "./tool"
import { Log } from "../util/log"

const log = Log.create({ service: "tool.notify" })

export const NotificationTool = Tool.define("send_notification", {
  description: "Send a notification to an external platform (Slack, Discord, etc.) via a webhook. Useful for reporting build status or long-running task completion.",
  parameters: z.object({
    platform: z.enum(["slack", "discord", "general"]),
    webhookUrl: z.string().url(),
    message: z.string(),
  }),
  async execute(params, ctx) {
    const { platform, webhookUrl, message } = params
    
    try {
      const payload = platform === "slack" 
        ? { text: message } 
        : platform === "discord" 
          ? { content: message } 
          : { message }

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)

      return {
        title: `Notification sent to ${platform}`,
        output: `Successfully delivered message to ${platform}.`,
        metadata: { status: res.status }
      }
    } catch (err) {
      log.error("notification failed", { err })
      throw err
    }
  },
})
