import { tool } from "@kronoscode-ai/plugin"
import { z } from "zod"
import { readFile } from "node:fs/promises"
import { extname, basename } from "node:path"

type FileType =
  | "react"
  | "vue"
  | "svelte"
  | "solid"
  | "image"
  | "model-3d"
  | "svg"
  | "markdown"
  | "html"
  | "css"
  | "unknown"

const FILE_TYPE_MAP: Record<string, FileType> = {
  ".tsx": "react",
  ".jsx": "react",
  ".vue": "vue",
  ".svelte": "svelte",
  ".solid.tsx": "solid",
  ".solid.jsx": "solid",
  ".glb": "model-3d",
  ".gltf": "model-3d",
  ".obj": "model-3d",
  ".fbx": "model-3d",
  ".stl": "model-3d",
  ".3dm": "model-3d",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".gif": "image",
  ".webp": "image",
  ".bmp": "image",
  ".svg": "svg",
  ".md": "markdown",
  ".mdx": "markdown",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "css",
  ".less": "css",
}

function detectFileType(filePath: string): FileType {
  return FILE_TYPE_MAP[extname(filePath).toLowerCase()] || "unknown"
}

interface ComponentInfo {
  type: "react" | "vue" | "svelte" | "solid"
  componentName: string
  props: string[]
  hasState: boolean
  hasEffects: boolean
  imports: string[]
}

function parseUIComponent(content: string, fileType: FileType): ComponentInfo | undefined {
  if (!["react", "vue", "svelte", "solid"].includes(fileType)) {
    return undefined
  }

  const imports: string[] = []
  for (const match of content.matchAll(/import\s+.*?from\s+['"](.+?)['"]/g)) {
    imports.push(match[1])
  }

  let componentName = "Unknown"
  let hasState = false
  let hasEffects = false
  const props: string[] = []

  if (fileType === "react") {
    const fnMatch = content.match(/(?:function|const)\s+(\w+)\s*(?:=|=\s*function)/)
    if (fnMatch) componentName = fnMatch[1]
    hasState = /\buseState\b/.test(content)
    hasEffects = /\buseEffect\b/.test(content)
    for (const prop of content.matchAll(/{\s*(?:{\s*)?([^}]+?)\s*(?:}\s*)?}\s*[=:]/g)) {
      const nameMatch = prop[1].match(/(\w+)\s*[}:]/)
      if (nameMatch) props.push(nameMatch[1])
    }
  } else if (fileType === "vue") {
    const nameMatch = content.match(/<script[^>]*>\s*export\s+default\s*{[^}]*name:\s*['"](\w+)['"]/s)
    componentName = nameMatch ? nameMatch[1] : basename(fileType).replace(".vue", "")
    hasState = /ref\(|reactive\(/.test(content)
    hasEffects = /watch\(|watchEffect\(/.test(content)
  } else if (fileType === "svelte") {
    const nameMatch = content.match(/<script[^>]*>\s*export\s+let\s+(\w+)/s)
    componentName = nameMatch ? nameMatch[1] : basename(fileType).replace(".svelte", "")
    hasState = /\$:/.test(content)
  }

  return { type: fileType as ComponentInfo["type"], componentName, props, hasState, hasEffects, imports }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export const previewTool = tool({
  description: `Preview and render UI components, 3D models, and visual files.

Supported: React (.tsx, .jsx), Vue (.vue), Svelte (.svelte), Solid, 3D models (GLTF, GLB, OBJ, FBX), images, SVG, Markdown, HTML, CSS.

Use inline mode for quick previews, side-panel for interactive split view.`,
  args: {
    filePath: z.string().describe("Path to the file to preview"),
    mode: z
      .enum(["inline", "side-panel", "fullscreen", "iframe"])
      .optional()
      .describe("Preview mode: inline (chat), side-panel (split view), fullscreen, or iframe")
      .default("inline"),
    theme: z.enum(["light", "dark", "auto"]).optional().describe("Theme for the preview").default("auto"),
    options: z
      .object({
        width: z.number().optional().describe("Custom width"),
        height: z.number().optional().describe("Custom height"),
        autoReload: z.boolean().optional().describe("Auto-reload on changes").default(true),
        component: z.string().optional().describe("For multi-component files"),
        frame: z.number().optional().describe("For 3D: animation frame"),
      })
      .optional(),
  },

  execute: async (args, ctx) => {
    const { filePath, mode, theme, options } = args

    try {
      const content = await readFile(filePath)
      const fileType = detectFileType(filePath)

      ctx.metadata({
        title: `Preview: ${basename(filePath)}`,
        metadata: { fileType, mode, previewable: fileType !== "unknown" },
      })

      switch (fileType) {
        case "react":
        case "vue":
        case "svelte":
        case "solid":
          return renderUIComponent(filePath, content.toString("utf-8"), fileType, mode!, theme!, options)
        case "model-3d":
          return render3DModel(filePath, content, mode!, theme!, options)
        case "image":
          return renderImage(filePath, content, mode!)
        case "svg":
          return renderSVG(filePath, content.toString("utf-8"), mode!)
        case "markdown":
          return renderMarkdown(filePath, content.toString("utf-8"), mode!)
        case "html":
          return renderHTML(filePath, content.toString("utf-8"), mode!)
        case "css":
          return renderCSS(filePath, content.toString("utf-8"))
        default:
          return renderUnsupported(filePath, fileType)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return `## Preview Error\n\nFailed to preview \`${filePath}\`:\n\n\`\`\`\n${msg}\n\`\`\``
    }
  },
})

function renderUIComponent(
  filePath: string,
  content: string,
  fileType: FileType,
  mode: string,
  theme: string,
  options?: any,
): string {
  const info = parseUIComponent(content, fileType)
  const fileName = basename(filePath)

  if (mode === "side-panel") {
    return `---

## 🔲 Preview Panel

**Opening:** \`${fileName}\` in side panel mode

\`\`\`json
${JSON.stringify(
  {
    type: "ui-component",
    fileType,
    fileName,
    componentName: info?.componentName || "Component",
    preview: { url: `file://${filePath}`, componentInfo: info, theme },
  },
  null,
  2,
)}
\`\`\`

*This will be rendered in a split panel view.*

---
`
  }

  const propsList = info?.props.length ? `\n\n**Props:** ${info.props.join(", ")}` : ""
  const hooks: string[] = []
  if (info?.hasState) hooks.push("State Management")
  if (info?.hasEffects) hooks.push("Side Effects")

  return `## UI Component Preview

**File:** \`${fileName}\`
**Framework:** ${fileType.toUpperCase()}
**Component:** \`${info?.componentName || "Unknown"}\`

${
  info
    ? `
| Property | Value |
|----------|-------|
| Has State | ${info.hasState ? "✅ Yes" : "❌ No"} |
| Has Effects | ${info.hasEffects ? "✅ Yes" : "❌ No"} |
| Props | ${info.props.length || "None"} |
| Imports | ${info.imports.length} |
${propsList}
${hooks.length ? `\n**Uses:** ${hooks.join(", ")}` : ""}`
    : ""
}

---

Use **side-panel mode** for interactive preview: \`/preview ${filePath} --mode side-panel\`
`
}

function render3DModel(filePath: string, content: Buffer, mode: string, theme: string, options?: any): string {
  const ext = extname(filePath).toLowerCase()
  const format = ext.replace(".", "").toUpperCase()
  const fileName = basename(filePath)

  if (mode === "side-panel") {
    return `---

## 🔲 Preview Panel

**Opening 3D model:** \`${fileName}\`

\`\`\`json
${JSON.stringify(
  {
    type: "3d-model",
    fileType: format,
    fileName,
    preview: { url: `file://${filePath}`, format, frame: options?.frame || 0, theme },
  },
  null,
  2,
)}
\`\`\`

*3D viewer with orbit controls will open in side panel.*

---
`
  }

  return `## 3D Model Preview

**File:** \`${fileName}\`
**Format:** ${format}
**Size:** ${formatBytes(content.byteLength)}

Use **side-panel mode** for interactive 3D preview:
\`/preview ${filePath} --mode side-panel\`
`
}

function renderImage(filePath: string, content: Buffer, mode: string): string {
  const fileName = basename(filePath)

  return `## Image Preview

**File:** \`${fileName}\`
**Size:** ${formatBytes(content.byteLength)}

![${fileName}](file://${filePath})
`
}

function renderSVG(filePath: string, content: string, mode: string): string {
  const fileName = basename(filePath)
  const hasStyle = /<style/.test(content)
  const hasScript = /<script/.test(content)

  return `## SVG Preview

**File:** \`${fileName}\`

| Property | Value |
|----------|-------|
| Has Styles | ${hasStyle ? "✅ Yes" : "❌ No"} |
| Has Scripts | ${hasScript ? "⚠️ Yes" : "❌ No"} |
| Size | ${formatBytes(Buffer.byteLength(content))} |

\`\`\`svg
${content.slice(0, 500)}${content.length > 500 ? "\n... (truncated)" : ""}
\`\`\`

Use **side-panel mode** for full preview: \`/preview ${filePath} --mode side-panel\`
`
}

function renderMarkdown(filePath: string, content: string, mode: string): string {
  const fileName = basename(filePath)
  const lines = content.split("\n").length

  return `## Markdown Preview

**File:** \`${fileName}\`
**Lines:** ${lines}

${content.slice(0, 2000)}${content.length > 2000 ? "\n\n... (truncated)" : ""}

Use **side-panel mode** for rendered preview: \`/preview ${filePath} --mode side-panel\`
`
}

function renderHTML(filePath: string, content: string, mode: string): string {
  const fileName = basename(filePath)

  return `## HTML Preview

**File:** \`${fileName}\`

${content.slice(0, 1000)}${content.length > 1000 ? "\n... (truncated)" : ""}

Use **side-panel mode** to render: \`/preview ${filePath} --mode side-panel\`
`
}

function renderCSS(filePath: string, content: string): string {
  const fileName = basename(filePath)
  const selectors = (content.match(/[.#@]?[\w-]+\s*[{]/g) || []).length
  const variables = (content.match(/--[\w-]+:/g) || []).length
  const mediaQueries = (content.match(/@media/g) || []).length

  return `## CSS Preview

**File:** \`${fileName}\`

| Metric | Count |
|--------|-------|
| Selectors | ${selectors} |
| Variables | ${variables} |
| Media Queries | ${mediaQueries} |

\`\`\`css
${content.slice(0, 1500)}${content.length > 1500 ? "\n... (truncated)" : ""}
\`\`\`
`
}

function renderUnsupported(filePath: string, fileType: FileType): string {
  return `## Preview Unavailable

**File:** \`${filePath}\`
**Type:** ${fileType}

Supported types: React, Vue, Svelte, Solid, GLTF, GLB, OBJ, FBX, STL, images, SVG, Markdown, HTML, CSS.
`
}

export default previewTool
