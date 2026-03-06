import type { Message, Part, ToolPart } from "@kronoscode-ai/sdk/v2"

export type MediaKind = "image" | "video"

export type MediaItem = {
  id: string
  sessionID: string
  messageID: string
  partID: string
  tool: string
  mime: string
  url: string
  filename?: string
  kind: MediaKind
  time: number
  title?: string
  url_hint?: string
  page_id?: string
}

const DEFAULT_BROWSER_TOOL_PATTERN =
  "browser_|kronoschamber_browser_|mcp__.*__(browser_|browseros_|computer_use|computer[-_]?use|desktop|screen|screenshot|capture)|playwright|screenshot|capture|get_screen|take_screenshot|viewport_screenshot|webfetch|e2b"

type Attachment = {
  mime?: string
  url?: string
  filename?: string
  title?: string
  url_hint?: string
  page_id?: string
  metadata?: {
    title?: string
    url?: string
    url_hint?: string
    page_id?: string
    id?: string
  }
}

function text(input: unknown) {
  if (typeof input !== "string") return undefined
  const trimmed = input.trim()
  if (!trimmed) return undefined
  return trimmed
}

export function compileBrowserToolPattern(pattern?: string) {
  return new RegExp(pattern?.trim() || DEFAULT_BROWSER_TOOL_PATTERN, "i")
}

export function extractMediaItems(input: {
  sessionID: string
  messages: Message[]
  partsByMessage: Record<string, Part[]>
  browserToolPattern?: string
}) {
  const regex = compileBrowserToolPattern(input.browserToolPattern)
  const items = input.messages.flatMap((message) => {
    const parts = input.partsByMessage[message.id] ?? []
    return parts.flatMap((part) => {
      if (part.type !== "tool") return []
      if (!regex.test(part.tool)) return []
      if (part.state.status !== "completed") return []
      if (part.state.time.compacted) return []
      const attachments = (part.state.attachments ?? []) as Attachment[]
      return attachments
        .flatMap((attachment, index) => {
          const mime = attachment.mime ?? ""
          const url = attachment.url ?? ""
          if (!url) return []
          if (!mime.startsWith("image/") && !mime.startsWith("video/")) return []
          const kind: MediaKind = mime.startsWith("video/") ? "video" : "image"
          const title = text(attachment.title) ?? text(attachment.metadata?.title)
          const url_hint =
            text(attachment.url_hint) ?? text(attachment.metadata?.url_hint) ?? text(attachment.metadata?.url)
          const page_id = text(attachment.page_id) ?? text(attachment.metadata?.page_id) ?? text(attachment.metadata?.id)
          return {
            id: `${part.id}:${index}`,
            sessionID: input.sessionID,
            messageID: message.id,
            partID: part.id,
            tool: part.tool,
            mime,
            url,
            filename: attachment.filename,
            kind,
            time: message.time.created,
            title,
            url_hint,
            page_id,
          }
        })
        .filter(Boolean)
    })
  })

  const unique = new Map<string, MediaItem>()
  for (const item of items) {
    const key = [item.tool, item.mime, item.url].join("|")
    if (!unique.has(key)) unique.set(key, item)
  }

  return Array.from(unique.values()).sort((a, b) => {
    if (a.time !== b.time) return a.time - b.time
    return a.id.localeCompare(b.id)
  })
}

export function mediaKindFromMime(mime: string): MediaKind | undefined {
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
}

export function isToolPart(part: Part): part is ToolPart {
  return part.type === "tool"
}
