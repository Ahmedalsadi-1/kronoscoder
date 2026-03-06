import fs from "fs/promises"
import path from "path"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { Glob } from "@/util/glob"
import { Log } from "@/util/log"

export namespace GlobalAssetsMigration {
  const log = Log.create({ service: "global-assets-migration" })

  const SOURCE_ORDER = ["agents", "codex", "claude", "opencode"] as const
  type SourceName = (typeof SOURCE_ORDER)[number]

  const LINKED_STATES = new Set(["linked", "replaced", "already-linked"])

  export interface Options {
    dryRun?: boolean
    force?: boolean
    includeSystem?: boolean
  }

  export interface SourceSummary {
    source: SourceName
    root: string
    exists: boolean
    scannedSkills: number
    scannedAgents: number
  }

  export type AssetStatus = "linked" | "replaced" | "already-linked" | "skipped" | "conflict"

  export interface AssetRecord {
    kind: "skill" | "agent"
    source: SourceName
    sourcePath: string
    realPath: string
    targetPath: string
    status: AssetStatus
    reason?: string
  }

  export interface Result {
    dryRun: boolean
    force: boolean
    includeSystem: boolean
    paths: {
      root: string
      skills: string
      agents: string
      manifest: string
    }
    summary: {
      scanned: number
      selected: number
      linked: number
      skipped: number
      conflicts: number
    }
    sources: SourceSummary[]
    assets: AssetRecord[]
    mappings: Record<string, string>
    generatedAt: string
  }

  interface Candidate {
    kind: "skill" | "agent"
    source: SourceName
    sourcePath: string
    sourceRelative: string
    realPath: string
    targetPath: string
    precedence: number
    index: number
  }

  interface ScanSpec {
    source: SourceName
    root: string
    skillPattern: string
    agentPattern: string
  }

  export function paths() {
    const root = path.join(Global.Path.home, ".kronoscode")
    return {
      root,
      skills: path.join(root, "skills"),
      agents: path.join(root, "agents"),
      manifest: path.join(root, "migration", "global-assets-manifest.json"),
    }
  }

  export async function sync(input: Options = {}): Promise<Result> {
    const options = {
      dryRun: Boolean(input.dryRun),
      force: Boolean(input.force),
      includeSystem: Boolean(input.includeSystem),
    }
    const p = paths()
    const generatedAt = new Date().toISOString()
    const specs = scanSpecs()
    const sources: SourceSummary[] = []
    const discovered: Candidate[] = []
    const assets: AssetRecord[] = []

    for (const spec of specs) {
      const exists = await Filesystem.isDir(spec.root)
      const sourceSummary: SourceSummary = {
        source: spec.source,
        root: spec.root,
        exists,
        scannedSkills: 0,
        scannedAgents: 0,
      }
      sources.push(sourceSummary)
      if (!exists) continue

      const [skillMatches, agentMatches] = await Promise.all([
        Glob.scan(spec.skillPattern, {
          cwd: spec.root,
          absolute: true,
          include: "file",
          dot: true,
          symlink: true,
        }),
        Glob.scan(spec.agentPattern, {
          cwd: spec.root,
          absolute: true,
          include: "file",
          dot: true,
          symlink: true,
        }),
      ])
      sourceSummary.scannedSkills = skillMatches.length
      sourceSummary.scannedAgents = agentMatches.length

      for (const sourcePath of skillMatches) {
        const skillSlug = path.basename(path.dirname(sourcePath))
        const targetPath = path.join(p.skills, skillSlug, "SKILL.md")
        discovered.push(
          await buildCandidate({
            kind: "skill",
            source: spec.source,
            sourcePath,
            sourceRelative: path.relative(spec.root, sourcePath),
            targetPath,
            index: discovered.length,
          }),
        )
      }

      for (const sourcePath of agentMatches) {
        const agentSlug = path.basename(sourcePath, path.extname(sourcePath))
        const targetPath = path.join(p.agents, `${agentSlug}.md`)
        discovered.push(
          await buildCandidate({
            kind: "agent",
            source: spec.source,
            sourcePath,
            sourceRelative: path.relative(spec.root, sourcePath),
            targetPath,
            index: discovered.length,
          }),
        )
      }
    }

    const sorted = discovered.sort((a, b) => {
      if (a.precedence !== b.precedence) return a.precedence - b.precedence
      return a.index - b.index
    })
    const selected = new Map<string, Candidate>()
    const seenRealpath = new Set<string>()

    for (const candidate of sorted) {
      if (!options.includeSystem && shouldExcludeSystemSkill(candidate)) {
        assets.push({
          ...candidate,
          status: "skipped",
          reason: "excluded-codex-system-skill",
        })
        continue
      }

      const realKey = `${candidate.kind}:${candidate.realPath}`
      if (seenRealpath.has(realKey)) {
        assets.push({
          ...candidate,
          status: "skipped",
          reason: "duplicate-realpath",
        })
        continue
      }
      seenRealpath.add(realKey)

      if (selected.has(candidate.targetPath)) {
        assets.push({
          ...candidate,
          status: "skipped",
          reason: "duplicate-target",
        })
        continue
      }

      selected.set(candidate.targetPath, candidate)
    }

    const migratorOwnedTargets = await previouslyManagedTargets(p.manifest)
    for (const candidate of selected.values()) {
      const record = await syncOne({
        candidate,
        dryRun: options.dryRun,
        force: options.force,
        migratorOwnedTargets,
      })
      assets.push(record)
    }

    const summary = {
      scanned: discovered.length,
      selected: selected.size,
      linked: assets.filter((item) => item.status === "linked" || item.status === "replaced").length,
      skipped: assets.filter((item) => item.status === "skipped" || item.status === "already-linked").length,
      conflicts: assets.filter((item) => item.status === "conflict").length,
    }

    const mappings = Object.fromEntries(
      assets
        .filter((item) => LINKED_STATES.has(item.status))
        .map((item) => [item.sourcePath, item.targetPath] as const),
    )

    const result: Result = {
      dryRun: options.dryRun,
      force: options.force,
      includeSystem: options.includeSystem,
      paths: p,
      summary,
      sources,
      assets,
      mappings,
      generatedAt,
    }

    if (!options.dryRun) {
      await Filesystem.writeJson(p.manifest, {
        version: 1,
        generatedAt,
        dryRun: options.dryRun,
        force: options.force,
        includeSystem: options.includeSystem,
        summary,
        sources,
        assets,
        mappings,
      })
    }

    log.info("sync complete", {
      dryRun: options.dryRun,
      force: options.force,
      includeSystem: options.includeSystem,
      summary,
      manifest: p.manifest,
    })

    return result
  }

  function scanSpecs(): ScanSpec[] {
    const home = Global.Path.home
    return [
      {
        source: "agents",
        root: path.join(home, ".agents"),
        skillPattern: "skills/**/SKILL.md",
        agentPattern: "{agent,agents}/**/*.md",
      },
      {
        source: "codex",
        root: path.join(home, ".codex"),
        skillPattern: "skills/**/SKILL.md",
        agentPattern: "{agent,agents}/**/*.md",
      },
      {
        source: "claude",
        root: path.join(home, ".claude"),
        skillPattern: "skills/**/SKILL.md",
        agentPattern: "{agent,agents}/**/*.md",
      },
      {
        source: "opencode",
        root: path.join(home, ".config", "opencode"),
        skillPattern: "{skill,skills}/**/SKILL.md",
        agentPattern: "{agent,agents}/**/*.md",
      },
      {
        source: "opencode",
        root: path.join(home, ".opencode"),
        skillPattern: "{skill,skills}/**/SKILL.md",
        agentPattern: "{agent,agents}/**/*.md",
      },
    ]
  }

  async function buildCandidate(input: {
    kind: Candidate["kind"]
    source: SourceName
    sourcePath: string
    sourceRelative: string
    targetPath: string
    index: number
  }): Promise<Candidate> {
    return {
      ...input,
      realPath: await safeRealPath(input.sourcePath),
      precedence: SOURCE_ORDER.indexOf(input.source),
      index: input.index,
    }
  }

  function shouldExcludeSystemSkill(candidate: Candidate) {
    if (candidate.kind !== "skill") return false
    if (candidate.source !== "codex") return false
    const normalized = candidate.sourceRelative.replaceAll("\\", "/")
    return normalized.startsWith("skills/.system/")
  }

  async function previouslyManagedTargets(manifestPath: string) {
    const targets = new Set<string>()
    const manifest = await Filesystem.readJson<{
      assets?: { targetPath: string; status: AssetStatus }[]
    }>(manifestPath).catch(() => undefined)
    for (const item of manifest?.assets ?? []) {
      if (!LINKED_STATES.has(item.status)) continue
      targets.add(path.resolve(item.targetPath))
    }
    return targets
  }

  async function syncOne(input: {
    candidate: Candidate
    dryRun: boolean
    force: boolean
    migratorOwnedTargets: Set<string>
  }): Promise<AssetRecord> {
    const { candidate } = input
    const targetPath = path.resolve(candidate.targetPath)
    const existing = await fs.lstat(targetPath).catch(() => undefined)

    if (!existing) {
      if (!input.dryRun) await link(candidate.sourcePath, targetPath)
      return {
        ...candidate,
        targetPath,
        status: "linked",
        reason: input.dryRun ? "dry-run" : undefined,
      }
    }

    if (existing.isSymbolicLink()) {
      const current = await resolveCurrentLinkTarget(targetPath)
      if (current === candidate.realPath) {
        return {
          ...candidate,
          targetPath,
          status: "already-linked",
        }
      }

      const migratorOwned = input.migratorOwnedTargets.has(targetPath)
      if (input.force || migratorOwned) {
        if (!input.dryRun) {
          await fs.rm(targetPath, { recursive: true, force: true })
          await link(candidate.sourcePath, targetPath)
        }
        return {
          ...candidate,
          targetPath,
          status: "replaced",
          reason: input.dryRun ? "dry-run" : migratorOwned ? "migrator-owned" : "force",
        }
      }
    } else if (input.force) {
      if (!input.dryRun) {
        await fs.rm(targetPath, { recursive: true, force: true })
        await link(candidate.sourcePath, targetPath)
      }
      return {
        ...candidate,
        targetPath,
        status: "replaced",
        reason: input.dryRun ? "dry-run" : "force",
      }
    }

    return {
      ...candidate,
      targetPath,
      status: "conflict",
      reason: "existing-path-not-managed",
    }
  }

  async function link(sourcePath: string, targetPath: string) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true })
    try {
      await fs.symlink(path.resolve(sourcePath), targetPath)
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code !== "EEXIST") throw error
      const current = await resolveCurrentLinkTarget(targetPath)
      const expected = await safeRealPath(sourcePath)
      if (current === expected) return
      throw error
    }
  }

  async function resolveCurrentLinkTarget(targetPath: string) {
    const raw = await fs.readlink(targetPath).catch(() => undefined)
    if (!raw) return undefined
    const absolute = path.isAbsolute(raw) ? raw : path.resolve(path.dirname(targetPath), raw)
    return safeRealPath(absolute)
  }

  async function safeRealPath(input: string) {
    return fs.realpath(input).catch(() => path.resolve(input))
  }
}
