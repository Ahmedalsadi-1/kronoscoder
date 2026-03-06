import { $, semver } from "bun"
import path from "path"

const rootPkgPath = path.resolve(import.meta.dir, "../../../package.json")
const rootPkg = await Bun.file(rootPkgPath).json()
const expectedBunVersion = rootPkg.packageManager?.split("@")[1]

if (!expectedBunVersion) {
  throw new Error("packageManager field not found in root package.json")
}

// relax version requirement
const expectedBunVersionRange = `^${expectedBunVersion}`

if (!semver.satisfies(process.versions.bun, expectedBunVersionRange)) {
  throw new Error(`This script requires bun@${expectedBunVersionRange}, but you are using bun@${process.versions.bun}`)
}

const env = {
  KRONOSCODE_CHANNEL: process.env["KRONOSCODE_CHANNEL"],
  KRONOSCODE_BUMP: process.env["KRONOSCODE_BUMP"],
  KRONOSCODE_VERSION: process.env["KRONOSCODE_VERSION"],
  KRONOSCODE_RELEASE: process.env["KRONOSCODE_RELEASE"],
}
const CHANNEL = await (async () => {
  if (env.KRONOSCODE_CHANNEL) return env.KRONOSCODE_CHANNEL
  if (env.KRONOSCODE_BUMP) return "latest"
  if (env.KRONOSCODE_VERSION && !env.KRONOSCODE_VERSION.startsWith("0.0.0-")) return "latest"
  return await $`git branch --show-current`.text().then((x) => x.trim())
})()
const IS_PREVIEW = CHANNEL !== "latest"

const VERSION = await (async () => {
  if (env.KRONOSCODE_VERSION) return env.KRONOSCODE_VERSION
  if (IS_PREVIEW) return `0.0.0-${CHANNEL}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`
  const version = await fetch("https://registry.npmjs.org/kronoscode-ai/latest")
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText)
      return res.json()
    })
    .then((data: any) => data.version)
  const [major, minor, patch] = version.split(".").map((x: string) => Number(x) || 0)
  const t = env.KRONOSCODE_BUMP?.toLowerCase()
  if (t === "major") return `${major + 1}.0.0`
  if (t === "minor") return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
})()

const team = [
  "actions-user",
  "kronoscode",
  "rekram1-node",
  "thdxr",
  "kommander",
  "jayair",
  "fwang",
  "MrMushrooooom",
  "adamdotdevin",
  "iamdavidhill",
  "Brendonovich",
  "nexxeln",
  "Hona",
  "jlongster",
  "kronoscode-agent[bot]",
  "R44VC0RP",
]

export const Script = {
  get channel() {
    return CHANNEL
  },
  get version() {
    return VERSION
  },
  get preview() {
    return IS_PREVIEW
  },
  get release(): boolean {
    return !!env.KRONOSCODE_RELEASE
  },
  get team() {
    return team
  },
}
console.log(`kronoscode script`, JSON.stringify(Script, null, 2))
