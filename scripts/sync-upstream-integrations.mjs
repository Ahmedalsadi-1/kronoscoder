#!/usr/bin/env bun
import { execSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const upstreamRoot = path.join(root, 'third_party', 'upstream')
const generatedRoot = path.join(root, 'third_party', 'generated')
const importedSkillsRoot = path.join(root, 'skills')

const repos = {
  openfang: {
    dir: path.join(upstreamRoot, 'openfang'),
    remote: 'https://github.com/RightNow-AI/openfang.git',
  },
  pluely: {
    dir: path.join(upstreamRoot, 'pluely'),
    remote: 'https://github.com/iamsrikanthnani/pluely.git',
  },
  screenpipe: {
    dir: path.join(upstreamRoot, 'screenpipe'),
    remote: 'https://github.com/screenpipe/screenpipe.git',
  },
}

const nowIso = new Date().toISOString()

const isGplLicense = (license) => /GPL/i.test(typeof license === 'string' ? license : '')

const assertImportAllowed = ({ repoName, sourcePath, license }) => {
  if (isGplLicense(license)) {
    throw new Error(`License guard violation: attempted to import GPL-licensed content from ${repoName}`)
  }

  if (repoName === 'screenpipe' && /(?:^|[\\/])ee(?:[\\/]|$)/.test(sourcePath)) {
    throw new Error('License guard violation: attempted to import from screenpipe/ee/**')
  }
}

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true })
}

const readText = async (filePath) => {
  return fs.readFile(filePath, 'utf8')
}

const writeText = async (filePath, content) => {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, content, 'utf8')
}

const writeJson = async (filePath, data) => {
  await writeText(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

const exists = async (filePath) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

const repoSha = (repoDir) => execSync(`git -C "${repoDir}" rev-parse HEAD`, { encoding: 'utf8' }).trim()

const detectLicense = async (repoName, repoDir) => {
  if (repoName === 'pluely') {
    const pkgPath = path.join(repoDir, 'package.json')
    if (await exists(pkgPath)) {
      const pkg = JSON.parse(await readText(pkgPath))
      return typeof pkg.license === 'string' ? pkg.license : 'UNKNOWN'
    }
  }

  if (repoName === 'openfang') {
    const cargoPath = path.join(repoDir, 'Cargo.toml')
    if (await exists(cargoPath)) {
      const cargo = await readText(cargoPath)
      const match = cargo.match(/license\s*=\s*"([^"]+)"/)
      if (match?.[1]) return match[1]
    }
  }

  if (repoName === 'screenpipe') {
    const licensePath = path.join(repoDir, 'LICENSE.md')
    if (await exists(licensePath)) {
      const content = await readText(licensePath)
      if (content.includes('MIT License')) {
        return 'MIT (ee/ excluded)'
      }
    }
  }

  return 'UNKNOWN'
}

const parseToml = (content, source) => {
  if (!globalThis.Bun?.TOML?.parse) {
    throw new Error(`Bun.TOML.parse is required to parse ${source}`)
  }
  try {
    return Bun.TOML.parse(content)
  } catch (error) {
    throw new Error(`Failed parsing TOML (${source}): ${error instanceof Error ? error.message : String(error)}`)
  }
}

const listFiles = async (dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  return entries
}

const importOpenfangMcpPresets = async () => {
  const integrationsDir = path.join(repos.openfang.dir, 'crates', 'openfang-extensions', 'integrations')
  const entries = (await listFiles(integrationsDir)).filter((entry) => entry.isFile() && entry.name.endsWith('.toml'))

  const presets = []
  const importedFiles = []

  for (const entry of entries) {
    const filePath = path.join(integrationsDir, entry.name)
    const parsed = parseToml(await readText(filePath), filePath)

    presets.push({
      source: `openfang:crates/openfang-extensions/integrations/${entry.name}`,
      id: typeof parsed.id === 'string' ? parsed.id : entry.name.replace(/\.toml$/i, ''),
      name: typeof parsed.name === 'string' ? parsed.name : entry.name,
      description: typeof parsed.description === 'string' ? parsed.description : '',
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((item) => typeof item === 'string') : [],
      category: typeof parsed.category === 'string' ? parsed.category : null,
      icon: typeof parsed.icon === 'string' ? parsed.icon : null,
      transport: {
        type: typeof parsed.transport?.type === 'string' ? parsed.transport.type : null,
        command: typeof parsed.transport?.command === 'string' ? parsed.transport.command : null,
        url: typeof parsed.transport?.url === 'string' ? parsed.transport.url : null,
        args: Array.isArray(parsed.transport?.args)
          ? parsed.transport.args.filter((arg) => typeof arg === 'string')
          : [],
      },
      requiredEnv: Array.isArray(parsed.required_env)
        ? parsed.required_env
            .filter((item) => item && typeof item === 'object')
            .map((item) => ({
              name: typeof item.name === 'string' ? item.name : '',
              label: typeof item.label === 'string' ? item.label : '',
              help: typeof item.help === 'string' ? item.help : '',
              isSecret: Boolean(item.is_secret),
              getUrl: typeof item.get_url === 'string' ? item.get_url : '',
            }))
        : [],
      oauthMeta:
        parsed.oauth && typeof parsed.oauth === 'object'
          ? {
              provider: typeof parsed.oauth.provider === 'string' ? parsed.oauth.provider : null,
              scopes: Array.isArray(parsed.oauth.scopes)
                ? parsed.oauth.scopes.filter((item) => typeof item === 'string')
                : [],
              authUrl: typeof parsed.oauth.auth_url === 'string' ? parsed.oauth.auth_url : null,
              tokenUrl: typeof parsed.oauth.token_url === 'string' ? parsed.oauth.token_url : null,
            }
          : null,
      setupInstructions: typeof parsed.setup_instructions === 'string' ? parsed.setup_instructions.trim() : '',
    })

    importedFiles.push(`openfang:crates/openfang-extensions/integrations/${entry.name}`)
  }

  presets.sort((a, b) => a.id.localeCompare(b.id))

  await writeJson(path.join(generatedRoot, 'openfang-mcp-presets.json'), presets)

  return {
    presetsCount: presets.length,
    importedFiles,
  }
}

const importOpenfangHands = async () => {
  const handsDir = path.join(repos.openfang.dir, 'crates', 'openfang-hands', 'bundled')
  const entries = (await listFiles(handsDir)).filter((entry) => entry.isDirectory())

  const templates = []
  const importedFiles = []

  for (const entry of entries) {
    const handDir = path.join(handsDir, entry.name)
    const handTomlPath = path.join(handDir, 'HAND.toml')
    const skillPath = path.join(handDir, 'SKILL.md')

    if (!(await exists(handTomlPath))) continue

    const hand = parseToml(await readText(handTomlPath), handTomlPath)
    const skillMarkdown = (await exists(skillPath)) ? await readText(skillPath) : ''

    templates.push({
      source: `openfang:crates/openfang-hands/bundled/${entry.name}`,
      id: typeof hand.id === 'string' ? hand.id : entry.name,
      name: typeof hand.name === 'string' ? hand.name : entry.name,
      description: typeof hand.description === 'string' ? hand.description : '',
      category: typeof hand.category === 'string' ? hand.category : null,
      icon: typeof hand.icon === 'string' ? hand.icon : null,
      tools: Array.isArray(hand.tools) ? hand.tools.filter((item) => typeof item === 'string') : [],
      settings: Array.isArray(hand.settings) ? hand.settings : [],
      requirements: Array.isArray(hand.requires) ? hand.requires : [],
      agent: hand.agent && typeof hand.agent === 'object'
        ? {
            name: typeof hand.agent.name === 'string' ? hand.agent.name : null,
            description: typeof hand.agent.description === 'string' ? hand.agent.description : null,
            provider: typeof hand.agent.provider === 'string' ? hand.agent.provider : null,
            model: typeof hand.agent.model === 'string' ? hand.agent.model : null,
            maxIterations: typeof hand.agent.max_iterations === 'number' ? hand.agent.max_iterations : null,
            maxTokens: typeof hand.agent.max_tokens === 'number' ? hand.agent.max_tokens : null,
            temperature: typeof hand.agent.temperature === 'number' ? hand.agent.temperature : null,
            systemPrompt: typeof hand.agent.system_prompt === 'string' ? hand.agent.system_prompt : '',
          }
        : null,
      skillMarkdown,
    })

    importedFiles.push(`openfang:crates/openfang-hands/bundled/${entry.name}/HAND.toml`)
    if (await exists(skillPath)) {
      importedFiles.push(`openfang:crates/openfang-hands/bundled/${entry.name}/SKILL.md`)
    }
  }

  templates.sort((a, b) => a.id.localeCompare(b.id))
  await writeJson(path.join(generatedRoot, 'openfang-hand-templates.json'), templates)

  return {
    handsCount: templates.length,
    importedFiles,
  }
}

const parseSimpleFrontmatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) {
    return { frontmatter: {}, body: content }
  }

  const frontmatterLines = match[1].split('\n')
  const frontmatter = {}

  for (const line of frontmatterLines) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const rawValue = line.slice(idx + 1).trim()
    if (!key) continue

    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      const values = rawValue
        .slice(1, -1)
        .split(',')
        .map((value) => value.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
      frontmatter[key] = values
      continue
    }

    frontmatter[key] = rawValue.replace(/^['"]|['"]$/g, '')
  }

  return {
    frontmatter,
    body: match[2],
  }
}

const importScreenpipeSkills = async (screenpipeLicense) => {
  const skillsDir = path.join(repos.screenpipe.dir, 'packages', 'skills', 'skills')
  const entries = (await listFiles(skillsDir)).filter((entry) => entry.isFile() && entry.name.endsWith('.md'))

  const imported = []
  const generatedSkills = []

  for (const entry of entries) {
    const sourcePath = path.join(skillsDir, entry.name)
    assertImportAllowed({ repoName: 'screenpipe', sourcePath, license: screenpipeLicense })

    const original = await readText(sourcePath)
    const parsed = parseSimpleFrontmatter(original)
    const sourceSkillName = typeof parsed.frontmatter.name === 'string'
      ? parsed.frontmatter.name
      : entry.name.replace(/\.md$/i, '')

    const kronosSkillName = sourceSkillName.startsWith('screenpipe-')
      ? sourceSkillName
      : `screenpipe-${sourceSkillName}`

    const skillPath = path.join(importedSkillsRoot, kronosSkillName, 'SKILL.md')

    const header = [
      '---',
      `name: ${kronosSkillName}`,
      `description: ${typeof parsed.frontmatter.description === 'string' ? parsed.frontmatter.description : 'Imported Screenpipe skill prompt'}`,
      '---',
      '',
      '> Attribution: Imported from screenpipe/screenpipe (MIT), packages/skills/skills.',
      '> Source: https://github.com/screenpipe/screenpipe',
      `> Imported: ${nowIso}`,
      '',
    ].join('\n')

    const content = `${header}${parsed.body.trim()}\n`

    await writeText(skillPath, content)

    generatedSkills.push({
      id: kronosSkillName,
      source: `screenpipe:packages/skills/skills/${entry.name}`,
      output: path.relative(root, skillPath),
    })
    imported.push(`screenpipe:packages/skills/skills/${entry.name}`)
  }

  await writeJson(path.join(generatedRoot, 'screenpipe-skills.json'), generatedSkills)

  return {
    skillsCount: generatedSkills.length,
    importedFiles: imported,
  }
}

const createManifest = async (summary) => {
  const manifestPath = path.join(root, 'third_party', 'INTEGRATION_MANIFEST.md')

  const lines = [
    '# Integration Manifest',
    '',
    `Updated: ${nowIso}`,
    '',
    '## Upstream Sources',
    '',
    '| Repo | Remote | Commit | License | Notes |',
    '| --- | --- | --- | --- | --- |',
    `| openfang | ${repos.openfang.remote} | ${summary.repos.openfang.sha} | ${summary.repos.openfang.license} | MCP presets + hand templates imported |`,
    `| pluely | ${repos.pluely.remote} | ${summary.repos.pluely.sha} | ${summary.repos.pluely.license} | Clean-room only (no code import due GPL) |`,
    `| screenpipe | ${repos.screenpipe.remote} | ${summary.repos.screenpipe.sha} | ${summary.repos.screenpipe.license} | Skills imported; ee/ excluded by guard |`,
    '',
    '## Imported Artifacts',
    '',
    `- \`third_party/generated/openfang-mcp-presets.json\` (${summary.counts.openfangPresets} presets)`,
    `- \`third_party/generated/openfang-hand-templates.json\` (${summary.counts.openfangHands} hand templates)`,
    `- \`third_party/generated/screenpipe-skills.json\` (${summary.counts.screenpipeSkills} skills)`,
    '',
    '## Imported Files (Allowlisted)',
    '',
    ...summary.importedFiles.map((file) => `- ${file}`),
    '',
    '## License Guard Rules',
    '',
    '- Never import GPL-licensed upstream code into Kronos core.',
    '- Never import any path under `screenpipe/ee/**`.',
    '- Pluely is referenced for clean-room behavior only in this integration track.',
    '',
  ]

  await writeText(manifestPath, lines.join('\n'))
}

const main = async () => {
  await ensureDir(generatedRoot)
  await ensureDir(importedSkillsRoot)

  for (const [name, repo] of Object.entries(repos)) {
    if (!(await exists(path.join(repo.dir, '.git')))) {
      throw new Error(`Missing cloned repo at ${repo.dir}. Clone ${repo.remote} first.`)
    }
  }

  const repoSummary = {
    openfang: {
      sha: repoSha(repos.openfang.dir),
      license: await detectLicense('openfang', repos.openfang.dir),
    },
    pluely: {
      sha: repoSha(repos.pluely.dir),
      license: await detectLicense('pluely', repos.pluely.dir),
    },
    screenpipe: {
      sha: repoSha(repos.screenpipe.dir),
      license: await detectLicense('screenpipe', repos.screenpipe.dir),
    },
  }

  if (/GPL/i.test(repoSummary.pluely.license)) {
    console.log('[sync-upstream-integrations] GPL detected for Pluely; skipping all Pluely code imports by policy.')
  }

  assertImportAllowed({ repoName: 'openfang', sourcePath: repos.openfang.dir, license: repoSummary.openfang.license })
  assertImportAllowed({ repoName: 'screenpipe', sourcePath: repos.screenpipe.dir, license: repoSummary.screenpipe.license })

  const openfangPresets = await importOpenfangMcpPresets()
  const openfangHands = await importOpenfangHands()
  const screenpipeSkills = await importScreenpipeSkills(repoSummary.screenpipe.license)

  const importedFiles = [
    ...openfangPresets.importedFiles,
    ...openfangHands.importedFiles,
    ...screenpipeSkills.importedFiles,
  ].sort()

  await createManifest({
    repos: repoSummary,
    counts: {
      openfangPresets: openfangPresets.presetsCount,
      openfangHands: openfangHands.handsCount,
      screenpipeSkills: screenpipeSkills.skillsCount,
    },
    importedFiles,
  })

  console.log('[sync-upstream-integrations] Completed successfully')
  console.log(`- OpenFang presets: ${openfangPresets.presetsCount}`)
  console.log(`- OpenFang hands: ${openfangHands.handsCount}`)
  console.log(`- Screenpipe skills: ${screenpipeSkills.skillsCount}`)
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('[sync-upstream-integrations] Failed:', error)
    process.exit(1)
  })
}

export const __syncIntegrationTestUtils = {
  isGplLicense,
  assertImportAllowed,
}
