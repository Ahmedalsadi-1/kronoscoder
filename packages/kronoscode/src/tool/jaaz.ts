import z from "zod"
import { Tool } from "./tool"
import { Log } from "@/util/log"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

const JAAZ_WEB_PORT = 5173
const JAAZ_SERVER_PORT = 8001
const JAAZ_SERVER_BASE = `http://127.0.0.1:${JAAZ_SERVER_PORT}`

const checkJaazServerHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${JAAZ_SERVER_BASE}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    })
    return response.ok
  } catch {
    return false
  }
}

const jaazUnavailableMessage = () =>
  `Jaaz server is not running on ${JAAZ_SERVER_BASE}.
Start Jaaz first, then retry:
- Frontend: cd react && npm run dev
- Backend: cd server && python main.py
- Web UI: http://localhost:${JAAZ_WEB_PORT}`

const requestJaazApi = async <T = any>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${JAAZ_SERVER_BASE}${path}`, init)
  if (!response.ok) {
    const details = await response.text().catch(() => "")
    throw new Error(`Jaaz API ${path} failed (${response.status})${details ? `: ${details}` : ""}`)
  }
  return (await response.json().catch(() => ({}))) as T
}

export const JaazTool = Tool.define("jaaz", {
  description:
    "Interact with Jaaz - Open source AI design agent with web interface. Use for generating images, posters, designs via web UI.",
  parameters: z.object({
    action: z.enum([
      "activate",
      "open_web",
      "status",
      "generate_image",
      "generate_batch",
      "list_models",
      "get_projects",
      "create_project",
      "export_design",
      "server_status",
    ]),
    prompt: z.string().optional().describe("Design prompt for image generation"),
    model: z.string().optional().describe("Model to use (flux, stable-diffusion, etc.)"),
    count: z.number().optional().describe("Number of images to generate (for batch)"),
    projectName: z.string().optional().describe("Name for a new project"),
    projectId: z.string().optional().describe("ID of the project to work with"),
    designId: z.string().optional().describe("ID of the design to export"),
    format: z.enum(["png", "jpg", "svg", "pdf"]).optional().describe("Export format"),
  }),
  async execute(args, ctx) {
    const log = Log.create({ service: "tool.jaaz" })
    log.info("Executing Jaaz tool", { action: args.action })

    let output = ""
    let title = "Jaaz"

    try {
      if (process.platform !== "darwin" && process.platform !== "win32") {
        return {
          title: "Jaaz Error",
          output: "Jaaz is available on macOS and Windows only.",
          metadata: { action: args.action },
        }
      }

      switch (args.action) {
        case "activate":
          // Launch Jaaz app
          if (process.platform === "darwin") {
            await execAsync(`open -a "Jaaz"`)
            output = "Jaaz activated. The app should now be open."
          } else {
            await execAsync(`start jaaz`)
            output = "Jaaz activated on Windows."
          }
          title = "Jaaz Activated"
          break

        case "status":
          // Check if Jaaz is running
          if (process.platform === "darwin") {
            const statusScript = `
              tell application "System Events"
                if exists (process "Jaaz") then
                  return "running"
                else
                  return "not_running"
                end if
              end tell
            `
            const { stdout: status } = await execAsync(`osascript -e '${statusScript}'`)
            output = `Jaaz status: ${status.trim()}`
          } else {
            output = "Jaaz status check on Windows requires PowerShell integration."
          }
          title = "Jaaz Status"
          break

        case "open_web":
          // Open Jaaz web interface in browser
          if (process.platform === "darwin") {
            await execAsync(`open -a "Google Chrome" http://localhost:${JAAZ_WEB_PORT}`)
            output = `Opening Jaaz web interface at http://localhost:${JAAZ_WEB_PORT}`
          } else {
            await execAsync(`start http://localhost:${JAAZ_WEB_PORT}`)
            output = `Opening Jaaz web interface at http://localhost:${JAAZ_WEB_PORT}`
          }
          title = "Jaaz Web Interface"
          break

        case "server_status":
          // Check if Jaaz server is running
          if (await checkJaazServerHealth()) {
            output = `Jaaz server is running on port ${JAAZ_SERVER_PORT}
- Web UI: http://localhost:${JAAZ_WEB_PORT}
- API: http://localhost:${JAAZ_SERVER_PORT}`
          } else {
            output = jaazUnavailableMessage()
          }
          title = "Jaaz Server Status"
          break

        case "list_models":
          // List available AI models (from Jaaz config)
          const modelsPath =
            process.platform === "darwin" ? "~/Library/Application Support/jaaz/models" : "%APPDATA%\\jaaz\\models"

          const listModelsScript = `do shell script "ls ~/Library/Application\\\\ Support/jaaz/models/ 2>/dev/null || echo 'Default models available'"`

          const { stdout: models } = await execAsync(`osascript -e '${listModelsScript}'`)
          output =
            models.trim() ||
            `Available models:
- Flux Dev (default)
- Stable Diffusion XL
- Ollama (local models)
- OpenAI DALL-E (via API)
- Claude Image (via API)`
          title = "Jaaz Models"
          break

        case "generate_image":
          if (!args.prompt) {
            throw new Error("prompt is required for generate_image")
          }
          if (!(await checkJaazServerHealth())) {
            throw new Error(jaazUnavailableMessage())
          }
          try {
            const payload = await requestJaazApi<{ id?: string; status?: string; message?: string }>("/api/generate", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                prompt: args.prompt,
                ...(args.model ? { model: args.model } : {}),
              }),
            })
            output = `Jaaz generation submitted${payload.id ? ` (job: ${payload.id})` : ""}.
Status: ${payload.status || "submitted"}
${payload.message ? `Message: ${payload.message}` : ""}`.trim()
          } catch (apiError) {
            throw new Error(
              `Jaaz generate endpoint is unavailable in this install. ${apiError instanceof Error ? apiError.message : String(apiError)}`,
            )
          }
          title = "Jaaz Image Generation"
          break

        case "generate_batch":
          if (!args.prompt) {
            throw new Error("prompt is required for generate_batch")
          }
          if (!(await checkJaazServerHealth())) {
            throw new Error(jaazUnavailableMessage())
          }
          const batchCount = args.count || 4
          try {
            const payload = await requestJaazApi<{ id?: string; status?: string; message?: string }>(
              "/api/generate/batch",
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  prompt: args.prompt,
                  count: batchCount,
                  ...(args.model ? { model: args.model } : {}),
                }),
              },
            )
            output = `Jaaz batch generation submitted${payload.id ? ` (job: ${payload.id})` : ""}.
Status: ${payload.status || "submitted"}
Count: ${batchCount}
${payload.message ? `Message: ${payload.message}` : ""}`.trim()
          } catch (apiError) {
            throw new Error(
              `Jaaz batch endpoint is unavailable in this install. ${apiError instanceof Error ? apiError.message : String(apiError)}`,
            )
          }
          title = "Jaaz Batch Generation"
          break

        case "get_projects":
          if (!(await checkJaazServerHealth())) {
            throw new Error(jaazUnavailableMessage())
          }
          try {
            const payload = await requestJaazApi<any[]>("/api/projects", {
              method: "GET",
            })
            if (!Array.isArray(payload) || payload.length === 0) {
              output = "No Jaaz projects found."
            } else {
              output = payload
                .map((project: any, index) => {
                  const id = typeof project?.id === "string" ? project.id : `project-${index + 1}`
                  const name = typeof project?.name === "string" ? project.name : id
                  return `${index + 1}. ${name} (${id})`
                })
                .join("\n")
            }
          } catch (apiError) {
            throw new Error(
              `Jaaz projects endpoint is unavailable in this install. ${apiError instanceof Error ? apiError.message : String(apiError)}`,
            )
          }
          title = "Jaaz Projects"
          break

        case "create_project":
          if (!args.projectName) {
            throw new Error("projectName is required for create_project")
          }
          if (!(await checkJaazServerHealth())) {
            throw new Error(jaazUnavailableMessage())
          }
          try {
            const payload = await requestJaazApi<{ id?: string; name?: string; message?: string }>("/api/projects", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ name: args.projectName }),
            })
            output = `Jaaz project created: ${payload.name || args.projectName}${payload.id ? ` (${payload.id})` : ""}
${payload.message ? `Message: ${payload.message}` : ""}`.trim()
          } catch (apiError) {
            throw new Error(
              `Jaaz project-create endpoint is unavailable in this install. ${apiError instanceof Error ? apiError.message : String(apiError)}`,
            )
          }
          title = "Jaaz Create Project"
          break

        case "export_design":
          if (!args.designId) {
            throw new Error("designId is required for export_design")
          }
          const exportFormat = args.format || "png"
          if (!(await checkJaazServerHealth())) {
            throw new Error(jaazUnavailableMessage())
          }
          try {
            const payload = await requestJaazApi<{ url?: string; status?: string; message?: string }>("/api/export", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                designId: args.designId,
                format: exportFormat,
              }),
            })
            output = `Jaaz export requested for ${args.designId} (${exportFormat}).
Status: ${payload.status || "submitted"}
${payload.url ? `Download: ${payload.url}` : ""}
${payload.message ? `Message: ${payload.message}` : ""}`.trim()
          } catch (apiError) {
            throw new Error(
              `Jaaz export endpoint is unavailable in this install. ${apiError instanceof Error ? apiError.message : String(apiError)}`,
            )
          }
          title = "Jaaz Export Design"
          break

        default:
          output = `Unknown action: ${args.action}`
          title = "Jaaz Error"
      }
    } catch (error: any) {
      log.error("Jaaz tool failed", { error: error.message })
      output = `Error: ${error.message}`
    }

    return {
      title,
      output,
      metadata: {
        action: args.action,
      },
    }
  },
})

const jaazMeta = {
  connector: "jaaz",
  risk_level: "medium",
  interactive: true,
  fallback: ["jaaz"],
}

export const JaazGenerateTool = Tool.define("jaaz_generate", {
  description: "Generate an image/design through Jaaz.",
  parameters: z.object({
    prompt: z.string().min(1),
    model: z.string().optional(),
  }),
  async execute(args, ctx) {
    const result = await JaazTool.init().then((tool) =>
      tool.execute({ action: "generate_image", prompt: args.prompt, model: args.model }, ctx),
    )
    return {
      ...result,
      title: "Jaaz Generate",
      metadata: { ...result.metadata, ...jaazMeta },
    }
  },
})

export const JaazGenerateBatchTool = Tool.define("jaaz_generate_batch", {
  description: "Generate a batch of images/designs through Jaaz.",
  parameters: z.object({
    prompt: z.string().min(1),
    model: z.string().optional(),
    count: z.number().int().min(1).max(20).optional(),
  }),
  async execute(args, ctx) {
    const result = await JaazTool.init().then((tool) =>
      tool.execute(
        { action: "generate_batch", prompt: args.prompt, model: args.model, count: args.count ?? 4 },
        ctx,
      ),
    )
    return {
      ...result,
      title: "Jaaz Generate Batch",
      metadata: { ...result.metadata, ...jaazMeta },
    }
  },
})

export const JaazProjectListTool = Tool.define("jaaz_project_list", {
  description: "List Jaaz projects.",
  parameters: z.object({}),
  async execute(_args, ctx) {
    const result = await JaazTool.init().then((tool) => tool.execute({ action: "get_projects" }, ctx))
    return {
      ...result,
      title: "Jaaz Project List",
      metadata: { ...result.metadata, ...jaazMeta },
    }
  },
})

export const JaazProjectCreateTool = Tool.define("jaaz_project_create", {
  description: "Create a Jaaz project.",
  parameters: z.object({
    projectName: z.string().min(1),
  }),
  async execute(args, ctx) {
    const result = await JaazTool.init().then((tool) =>
      tool.execute({ action: "create_project", projectName: args.projectName }, ctx),
    )
    return {
      ...result,
      title: "Jaaz Project Create",
      metadata: { ...result.metadata, ...jaazMeta },
    }
  },
})

export const JaazExportTool = Tool.define("jaaz_export", {
  description: "Export a Jaaz design.",
  parameters: z.object({
    designId: z.string().min(1),
    format: z.enum(["png", "jpg", "svg", "pdf"]).optional(),
  }),
  async execute(args, ctx) {
    const result = await JaazTool.init().then((tool) =>
      tool.execute({ action: "export_design", designId: args.designId, format: args.format }, ctx),
    )
    return {
      ...result,
      title: "Jaaz Export",
      metadata: { ...result.metadata, ...jaazMeta },
    }
  },
})
