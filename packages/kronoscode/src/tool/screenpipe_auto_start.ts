import { spawn } from "child_process"
import { Log } from "@/util/log"
import { Flag } from "@/flag/flag"

const log = Log.create({ service: "screenpipe.auto_start" })

const SCREENPIPE_PORT = 3030

export async function autoStartScreenpipe(): Promise<boolean> {
  if (!Flag.KRONOSCODE_AUTO_START_SCREENPIPE) {
    log.debug("Auto-start screenpipe disabled")
    return false
  }

  try {
    const response = await fetch(`http://127.0.0.1:${SCREENPIPE_PORT}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    })
    if (response.ok) {
      log.info("Screenpipe already running")
      return true
    }
  } catch {
    log.info("Screenpipe not running, attempting to start...")
  }

  try {
    const screenpipeProcess = spawn("screenpipe", ["--port", String(SCREENPIPE_PORT)], {
      detached: true,
      stdio: "ignore",
    })

    screenpipeProcess.unref()

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Screenpipe start timeout"))
      }, 10000)

      const checkInterval = setInterval(async () => {
        try {
          const response = await fetch(`http://127.0.0.1:${SCREENPIPE_PORT}/health`)
          if (response.ok) {
            clearInterval(checkInterval)
            clearTimeout(timeout)
            log.info("Screenpipe started successfully")
            resolve()
          }
        } catch {
          // Still starting...
        }
      }, 1000)
    })

    return true
  } catch (error) {
    log.error("Failed to auto-start screenpipe", { error })
    return false
  }
}

export async function ensureScreenpipeRunning(): Promise<boolean> {
  const response = await fetch(`http://127.0.0.1:${SCREENPIPE_PORT}/health`, {
    method: "GET",
    signal: AbortSignal.timeout(2000),
  })
  return response.ok
}
