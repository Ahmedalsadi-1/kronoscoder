import path from "path"
import { createHash } from "crypto"
import { mkdir } from "fs/promises"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"

const cacheRoot = path.join(Global.Path.cache, "tui", "media", "video")

function hash(input: string) {
  return createHash("sha256").update(input).digest("hex")
}

export async function isFfmpegAvailable() {
  const proc = Bun.spawn(["ffmpeg", "-version"], { stdout: "ignore", stderr: "ignore" })
  const code = await proc.exited
  return code === 0
}

export async function extractVideoFrame(inputPath: string, key: string, width = 640) {
  await mkdir(cacheRoot, { recursive: true })
  await Bun.write(path.join(cacheRoot, ".keep"), "")
  const output = path.join(cacheRoot, `${hash(`${key}:${inputPath}:${width}`)}.png`)
  if (await Filesystem.exists(output)) {
    return { output }
  }

  const hasFfmpeg = await isFfmpegAvailable()
  if (!hasFfmpeg) {
    return {
      error: "ffmpeg is required for video preview. Install ffmpeg to render video thumbnails.",
    }
  }

  const filter = `scale='min(${width},iw)':-1:flags=lanczos`
  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      inputPath,
      "-frames:v",
      "1",
      "-vf",
      filter,
      output,
    ],
    { stdout: "ignore", stderr: "pipe" },
  )
  const code = await proc.exited

  if (code !== 0) {
    const message = await new Response(proc.stderr).text()
    return {
      error: message.trim() || "ffmpeg failed to extract a video frame",
    }
  }

  if (!(await Filesystem.exists(output))) {
    return {
      error: "No preview frame was produced",
    }
  }

  return { output }
}
