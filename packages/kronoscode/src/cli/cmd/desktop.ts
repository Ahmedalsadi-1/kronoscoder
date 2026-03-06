import { cmd } from "./cmd"
import { Log } from "../../util/log"
import { spawn } from "child_process"
import { UI } from "../../cli/ui"
import { existsSync } from "fs"

const log = Log.create({ service: "cmd.desktop" })

export const DesktopCommand = cmd({
  command: "desktop",
  describe: "Launch the KronosChamber desktop application",
  builder: (yargs) => yargs,
  handler: async () => {
    log.info("launching desktop app")

    const env = { ...process.env }
    const runtimePort = (
      process.env.KRONOSCODE_PORT ||
      process.env.KRONOSCHAMBER_KRONOSCODE_PORT ||
      process.env.OPENCODE_PORT ||
      process.env.OPENCHAMBER_OPENCODE_PORT ||
      ""
    ).trim()
    if (runtimePort) {
      env.KRONOSCODE_PORT = runtimePort
      env.KRONOSCHAMBER_KRONOSCODE_PORT = runtimePort
      env.OPENCODE_PORT = runtimePort
      env.OPENCHAMBER_OPENCODE_PORT = runtimePort
    }

    const runtimeSkipStart = (
      process.env.KRONOSCODE_SKIP_START ||
      process.env.KRONOSCHAMBER_SKIP_KRONOSCODE_START ||
      process.env.OPENCODE_SKIP_START ||
      process.env.OPENCHAMBER_SKIP_OPENCODE_START ||
      ""
    ).trim()
    if (runtimeSkipStart) {
      env.KRONOSCODE_SKIP_START = runtimeSkipStart
      env.KRONOSCHAMBER_SKIP_KRONOSCODE_START = runtimeSkipStart
      env.OPENCODE_SKIP_START = runtimeSkipStart
      env.OPENCHAMBER_SKIP_OPENCODE_START = runtimeSkipStart
    }

    const runtimeExternalOnly = (
      process.env.KRONOSCODE_EXTERNAL_ONLY ||
      process.env.KRONOSCHAMBER_EXTERNAL_ONLY ||
      process.env.OPENCODE_EXTERNAL_ONLY ||
      process.env.OPENCHAMBER_EXTERNAL_ONLY ||
      ""
    ).trim()
    if (runtimeExternalOnly) {
      env.KRONOSCODE_EXTERNAL_ONLY = runtimeExternalOnly
      env.KRONOSCHAMBER_EXTERNAL_ONLY = runtimeExternalOnly
      env.OPENCODE_EXTERNAL_ONLY = runtimeExternalOnly
      env.OPENCHAMBER_EXTERNAL_ONLY = runtimeExternalOnly
    }

    const runtimePassword = (
      process.env.KRONOSCODE_SERVER_PASSWORD ||
      process.env.OPENCODE_SERVER_PASSWORD ||
      process.env.OPENCHAMBER_OPENCODE_SERVER_PASSWORD ||
      ""
    ).trim()
    if (runtimePassword) {
      env.KRONOSCODE_SERVER_PASSWORD = runtimePassword
      env.OPENCODE_SERVER_PASSWORD = runtimePassword
      env.OPENCHAMBER_OPENCODE_SERVER_PASSWORD = runtimePassword
    }

    const binary = [
      "/Applications/KronosChamber.app/Contents/MacOS/KronosChamber",
      `${process.env.HOME || ""}/Applications/KronosChamber.app/Contents/MacOS/KronosChamber`,
      // TODO(compat): remove legacy app binary fallback after one stable release.
      "/Applications/KronosChamber.app/Contents/MacOS/openchamber-desktop",
      `${process.env.HOME || ""}/Applications/KronosChamber.app/Contents/MacOS/openchamber-desktop`,
    ].find((candidate) => Boolean(candidate) && existsSync(candidate))

    if (binary) {
      const proc = spawn(binary, [], {
        env,
        detached: true,
        stdio: "ignore",
      })
      proc.unref()
      UI.println("Launching KronosChamber...")
      return
    }

    UI.println(
      `${UI.Style.TEXT_WARNING}Warning:${UI.Style.TEXT_NORMAL} Falling back to LaunchServices (open -a); external runtime env propagation may be limited.`
    )
    const proc = spawn("open", ["-a", "KronosChamber"], { stdio: "inherit", env })

    proc.on("error", () => {
      UI.error("Could not find KronosChamber.app. Please ensure it is installed in your Applications folder.")
    })

    UI.println("Launching KronosChamber...")
  },
})
