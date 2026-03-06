import { spawnSync } from "child_process"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { GlobalAssetsMigration } from "../../../migration/global-assets"
import { Glob } from "../../../util/glob"
import { Filesystem } from "../../../util/filesystem"
import { cmd } from "../cmd"
import { RestartAllCommand } from "./restart-all"

async function countSymlinks(pattern: string, root: string) {
  if (!(await Filesystem.isDir(root))) return 0
  const files = await Glob.scan(pattern, {
    cwd: root,
    absolute: true,
    include: "file",
    dot: true,
  })
  const counts = await Promise.all(
    files.map(async (filepath) => {
      const stat = await fs.lstat(filepath).catch(() => undefined)
      if (!stat) return 0
      return stat.isSymbolicLink() ? 1 : 0
    }),
  )
  return counts.reduce<number>((total, value) => total + value, 0)
}

export async function runDoctorChecks() {
  const envBinary = (process.env.KRONOSCODE_BINARY ?? "").trim()
  const lookup = process.platform === "win32" ? "where" : "which"
  const found = spawnSync(lookup, ["kronoscode"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
  const first = found.status === 0 ? (found.stdout || "").trim().split(/\s+/)[0] || "" : ""
  const pathValue = process.env.PATH ?? ""
  const entries = pathValue.split(path.delimiter).filter(Boolean)
  const checks = [
    path.join(os.homedir(), ".bun", "bin"),
    path.join(os.homedir(), ".local", "bin"),
    "/usr/local/bin",
  ]

  console.log(`kronoscode lookup: ${first || "not found on PATH"}`)
  console.log(`KRONOSCODE_BINARY: ${envBinary || "(unset)"}`)
  console.log(`PATH entries: ${entries.length}`)
  for (const item of checks) {
    const present = entries.includes(item)
    console.log(`${item}: ${present ? "present" : "missing"}`)
  }
  if (!first && !envBinary) {
    console.log("suggestion: run scripts/universal-install.sh or add ~/.local/bin to PATH")
  }

  const migrationPaths = GlobalAssetsMigration.paths()
  const skillsDirExists = await Filesystem.isDir(migrationPaths.skills)
  const agentsDirExists = await Filesystem.isDir(migrationPaths.agents)
  const manifestExists = await Filesystem.exists(migrationPaths.manifest)
  const [skillSymlinks, agentSymlinks] = await Promise.all([
    countSymlinks("**/SKILL.md", migrationPaths.skills),
    countSymlinks("**/*.md", migrationPaths.agents),
  ])

  console.log(`~/.kronoscode/skills: ${skillsDirExists ? "exists" : "missing"} (symlinks: ${skillSymlinks})`)
  console.log(`~/.kronoscode/agents: ${agentsDirExists ? "exists" : "missing"} (symlinks: ${agentSymlinks})`)
  console.log(`global-assets manifest: ${manifestExists ? migrationPaths.manifest : "missing"}`)
}

export const DoctorCommand = cmd({
  command: "doctor",
  describe: "check CLI readiness and run operational recovery commands",
  builder: (yargs) => yargs.command(RestartAllCommand),
  async handler() {
    await runDoctorChecks()
  },
})

