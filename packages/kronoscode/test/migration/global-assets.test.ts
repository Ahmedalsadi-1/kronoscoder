import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { GlobalAssetsMigration } from "../../src/migration/global-assets"

describe("GlobalAssetsMigration", () => {
  let previousHome: string | undefined
  let home: string

  beforeEach(async () => {
    previousHome = process.env.KRONOSCODE_TEST_HOME
    home = await fs.mkdtemp(path.join(os.tmpdir(), "kronoscode-global-assets-"))
    process.env.KRONOSCODE_TEST_HOME = home
  })

  afterEach(async () => {
    if (previousHome === undefined) delete process.env.KRONOSCODE_TEST_HOME
    else process.env.KRONOSCODE_TEST_HOME = previousHome
    await fs.rm(home, { recursive: true, force: true })
  })

  test("excludes ~/.codex/skills/.system by default", async () => {
    await writeSkill(path.join(home, ".agents", "skills", "visible-skill", "SKILL.md"), "visible-skill")
    await writeSkill(path.join(home, ".codex", "skills", ".system", "hidden-skill", "SKILL.md"), "hidden-skill")

    const result = await GlobalAssetsMigration.sync()
    const visibleTarget = path.join(home, ".kronoscode", "skills", "visible-skill", "SKILL.md")
    const hiddenTarget = path.join(home, ".kronoscode", "skills", "hidden-skill", "SKILL.md")

    expect(await isSymlink(visibleTarget)).toBe(true)
    expect(await exists(hiddenTarget)).toBe(false)
    expect(result.assets.find((item) => item.reason === "excluded-codex-system-skill")).toBeDefined()
  })

  test("deduplicates realpath mirrors across sources", async () => {
    const agentSource = path.join(home, ".agents", "skills", "shared-skill", "SKILL.md")
    await writeSkill(agentSource, "shared-skill")

    const codexSkillsDir = path.join(home, ".codex", "skills")
    await fs.mkdir(codexSkillsDir, { recursive: true })
    await fs.symlink(path.join(home, ".agents", "skills", "shared-skill"), path.join(codexSkillsDir, "shared-skill"))

    const result = await GlobalAssetsMigration.sync()
    const target = path.join(home, ".kronoscode", "skills", "shared-skill", "SKILL.md")

    expect(result.summary.linked).toBe(1)
    expect(result.assets.find((item) => item.reason === "duplicate-realpath")).toBeDefined()
    expect(await fs.realpath(target)).toBe(await fs.realpath(agentSource))
  })

  test("preserves conflicting files unless --force is set", async () => {
    const source = path.join(home, ".opencode", "agent", "system-admin.md")
    await writeAgent(source, "system-admin")

    const target = path.join(home, ".kronoscode", "agents", "system-admin.md")
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, "# user-authored agent\n", "utf8")

    const withoutForce = await GlobalAssetsMigration.sync()
    expect(withoutForce.summary.conflicts).toBe(1)
    expect(await isSymlink(target)).toBe(false)

    const withForce = await GlobalAssetsMigration.sync({ force: true })
    expect(withForce.summary.linked + withForce.summary.conflicts).toBeGreaterThan(0)
    expect(await isSymlink(target)).toBe(true)
    expect(await fs.realpath(target)).toBe(await fs.realpath(source))
  })

  test("is idempotent on repeated apply", async () => {
    await writeSkill(path.join(home, ".agents", "skills", "repeat-skill", "SKILL.md"), "repeat-skill")
    await writeAgent(path.join(home, ".opencode", "agent", "repeat-agent.md"), "repeat-agent")

    const first = await GlobalAssetsMigration.sync()
    const second = await GlobalAssetsMigration.sync()

    expect(first.summary.linked).toBe(2)
    expect(second.summary.linked).toBe(0)
    expect(second.summary.skipped).toBeGreaterThanOrEqual(2)
  })
})

async function writeSkill(filepath: string, name: string) {
  await fs.mkdir(path.dirname(filepath), { recursive: true })
  await fs.writeFile(
    filepath,
    `---
name: ${name}
description: test
---

# ${name}
`,
    "utf8",
  )
}

async function writeAgent(filepath: string, name: string) {
  await fs.mkdir(path.dirname(filepath), { recursive: true })
  await fs.writeFile(
    filepath,
    `---
description: ${name}
mode: all
---

# ${name}
`,
    "utf8",
  )
}

async function exists(filepath: string) {
  return fs.lstat(filepath).then(() => true).catch(() => false)
}

async function isSymlink(filepath: string) {
  return fs
    .lstat(filepath)
    .then((stat) => stat.isSymbolicLink())
    .catch(() => false)
}
