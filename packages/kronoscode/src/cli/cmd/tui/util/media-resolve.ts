import path from "path"
import { createHash } from "crypto"
import { mkdir } from "fs/promises"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import type { MediaItem } from "./media-extract"

export type ResolvedMedia = {
  localPath?: string
  originalUrl: string
  mime: string
  filename?: string
  error?: string
}

const cacheRoot = path.join(Global.Path.cache, "tui", "media")

function ext(mime: string) {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/bmp": "bmp",
    "image/tiff": "tiff",
    "image/avif": "avif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-msvideo": "avi",
    "video/x-matroska": "mkv",
  }
  if (map[mime]) return map[mime]
  const fallback = mime.split("/")[1] ?? "bin"
  return fallback.replace(/[^a-zA-Z0-9]/g, "") || "bin"
}

function digest(input: string) {
  return createHash("sha256").update(input).digest("hex")
}

async function ensureCache() {
  await mkdir(cacheRoot, { recursive: true })
  await Bun.write(path.join(cacheRoot, ".keep"), "")
}

export function isHttpUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://")
}

export function isDataUrl(url: string) {
  return url.startsWith("data:")
}

export function isFileUrl(url: string) {
  return url.startsWith("file://")
}

async function writeDataUrl(url: string, mime: string) {
  const comma = url.indexOf(",")
  if (comma === -1) return
  const meta = url.slice(5, comma)
  const body = url.slice(comma + 1)
  const encoded = meta.includes(";base64")
  const content = encoded ? Buffer.from(body, "base64") : Buffer.from(decodeURIComponent(body))
  const target = path.join(cacheRoot, `${digest(url)}.${ext(mime)}`)
  if (!(await Filesystem.exists(target))) {
    await Bun.write(target, content)
  }
  return target
}

async function writeHttpUrl(url: string, mime: string) {
  const target = path.join(cacheRoot, `${digest(url)}.${ext(mime)}`)
  if (await Filesystem.exists(target)) return target
  const response = await fetch(url).catch(() => undefined)
  if (!response || !response.ok) return
  const data = await response.arrayBuffer().catch(() => undefined)
  if (!data) return
  await Bun.write(target, Buffer.from(data))
  return target
}

function fileUrlToPath(url: string) {
  if (!isFileUrl(url)) return
  return decodeURIComponent(url.replace("file://", ""))
}

export async function resolveMedia(item: MediaItem): Promise<ResolvedMedia> {
  await ensureCache()

  const mime = item.mime || "application/octet-stream"
  const url = item.url

  if (isDataUrl(url)) {
    const localPath = await writeDataUrl(url, mime)
    if (localPath) return { localPath, originalUrl: url, mime, filename: item.filename }
    return { originalUrl: url, mime, filename: item.filename, error: "Invalid data URL" }
  }

  if (isHttpUrl(url)) {
    const localPath = await writeHttpUrl(url, mime)
    if (localPath) return { localPath, originalUrl: url, mime, filename: item.filename }
    return { originalUrl: url, mime, filename: item.filename, error: "Failed to download media" }
  }

  if (isFileUrl(url)) {
    const localPath = fileUrlToPath(url)
    if (!localPath) return { originalUrl: url, mime, filename: item.filename, error: "Invalid file URL" }
    if (!(await Filesystem.exists(localPath))) {
      return { originalUrl: url, mime, filename: item.filename, error: `File not found: ${localPath}` }
    }
    return { localPath, originalUrl: url, mime, filename: item.filename }
  }

  if (path.isAbsolute(url) && (await Filesystem.exists(url))) {
    return { localPath: url, originalUrl: url, mime, filename: item.filename }
  }

  return { originalUrl: url, mime, filename: item.filename, error: "Unsupported media URL" }
}
