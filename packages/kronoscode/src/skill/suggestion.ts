import { Filesystem } from "@/util/filesystem"
import path from "path"
import { Instance } from "../project/instance"
import { Skill } from "./skill"
import { Log } from "../util/log"

export namespace SkillSuggestion {
  const log = Log.create({ service: "skill-suggestion" })

  const SUGGESTION_MAP: Record<string, string[]> = {
    "react": ["react-dev", "vercel-react-best-practices"],
    "next": ["vercel-react-best-practices"],
    "solid-js": ["solid-js-best-practices"],
    "astro": ["astro-tips"],
    "tailwindcss": ["tailwind-best-practices"],
    "typescript": ["typescript-expert"],
    "drizzle-orm": ["drizzle-orm-helper"],
    "express": ["express-server-tips"],
    "fastapi": ["python-fastapi-best-practices"],
    "cloudflare": ["cloudflare-worker-expert"],
    "@cloudflare/workers-types": ["cloudflare-worker-expert"],
    "aws-sdk": ["aws-expert"],
    "firebase": ["firebase-expert"],
  }

  export async function suggest(): Promise<Skill.Info[]> {
    const suggestions = new Set<string>()
    const root = Instance.directory

    // Scan package.json
    try {
      const pkgPath = path.join(root, "package.json")
      if (await Filesystem.exists(pkgPath)) {
        const pkg = JSON.parse(await Filesystem.readText(pkgPath))
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }
        for (const dep of Object.keys(deps)) {
          if (SUGGESTION_MAP[dep]) {
            SUGGESTION_MAP[dep].forEach(s => suggestions.add(s))
          }
        }
      }
    } catch (err) {
      log.error("failed to parse package.json for suggestions", { err })
    }

    // Scan for other indicators
    if (await Filesystem.exists(path.join(root, "Cargo.toml"))) {
      suggestions.add("rust-expert")
    }
    if (await Filesystem.exists(path.join(root, "go.mod"))) {
      suggestions.add("go-expert")
    }
    if (await Filesystem.exists(path.join(root, "requirements.txt"))) {
      suggestions.add("python-expert")
    }

    const available = await Skill.all()
    const availableNames = new Set(available.map(s => s.name))

    // Filter to only suggested skills that are actually available
    return available.filter(s => suggestions.has(s.name))
  }
}
