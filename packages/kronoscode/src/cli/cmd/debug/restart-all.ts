import { spawnSync } from "child_process"
import fs from "fs"
import path from "path"
import { cmd } from "../cmd"

const REPO_ROOT = path.resolve(import.meta.dir, "../../../../../../")
const RESTART_SCRIPT = path.join(REPO_ROOT, "scripts", "restart-all.mjs")

export const RestartAllCommand = cmd({
  command: "restart-all",
  describe: "kill stale processes and restart backend/web (optionally desktop) with health checks",
  builder: (yargs) =>
    yargs
      .option("with-desktop", {
        type: "boolean",
        default: false,
        describe: "launch KronosChamber desktop after backend/web are healthy",
      })
      .option("with-browseros", {
        type: "boolean",
        default: false,
        describe: "install/start KronosOS agent server and verify health",
      })
      .option("with-kronosos", {
        type: "boolean",
        default: false,
        describe: "alias for --with-browseros",
      })
      .option("json", {
        type: "boolean",
        default: false,
        describe: "print machine-readable JSON summary",
      })
      .option("kill", {
        type: "boolean",
        default: true,
        describe: "kill existing listeners/processes before restart (use --no-kill to keep them)",
      }),
  handler(args) {
    if (!fs.existsSync(RESTART_SCRIPT)) {
      throw new Error(`Restart script not found: ${RESTART_SCRIPT}`)
    }

    const scriptArgs: string[] = []
    if (args["with-desktop"]) scriptArgs.push("--with-desktop")
    if (args["with-browseros"] || args["with-kronosos"]) scriptArgs.push("--with-browseros")
    if (args.json) scriptArgs.push("--json")
    if (!args.kill) scriptArgs.push("--no-kill")

    const child = spawnSync(process.execPath, [RESTART_SCRIPT, ...scriptArgs], {
      cwd: REPO_ROOT,
      env: { ...process.env },
      stdio: "inherit",
    })

    if (child.error) {
      throw child.error
    }
    if (typeof child.status === "number" && child.status !== 0) {
      throw new Error(`restart-all failed with exit code ${child.status}`)
    }
  },
})
