# Integration Manifest

Updated: 2026-03-06T18:39:01.413Z

## Upstream Sources

| Repo | Remote | Commit | License | Notes |
| --- | --- | --- | --- | --- |
| openfang | https://github.com/RightNow-AI/openfang.git | ebcdc17c138e463740ac7dd7178675f63be43715 | Apache-2.0 OR MIT | MCP presets + hand templates imported |
| pluely | https://github.com/iamsrikanthnani/pluely.git | 4fb23ac348ad087ef22920272012030398b6b155 | GPL-3.0 | Clean-room only (no code import due GPL) |
| screenpipe | https://github.com/screenpipe/screenpipe.git | c1b45bd0f50f9dc5ec4f07e3a3aaec427b7f839c | MIT (ee/ excluded) | Skills imported; ee/ excluded by guard |

## Imported Artifacts

- `third_party/generated/openfang-mcp-presets.json` (25 presets)
- `third_party/generated/openfang-hand-templates.json` (7 hand templates)
- `third_party/generated/screenpipe-skills.json` (4 skills)

## Imported Files (Allowlisted)

- openfang:crates/openfang-extensions/integrations/aws.toml
- openfang:crates/openfang-extensions/integrations/azure-mcp.toml
- openfang:crates/openfang-extensions/integrations/bitbucket.toml
- openfang:crates/openfang-extensions/integrations/brave-search.toml
- openfang:crates/openfang-extensions/integrations/discord-mcp.toml
- openfang:crates/openfang-extensions/integrations/dropbox.toml
- openfang:crates/openfang-extensions/integrations/elasticsearch.toml
- openfang:crates/openfang-extensions/integrations/exa-search.toml
- openfang:crates/openfang-extensions/integrations/gcp-mcp.toml
- openfang:crates/openfang-extensions/integrations/github.toml
- openfang:crates/openfang-extensions/integrations/gitlab.toml
- openfang:crates/openfang-extensions/integrations/gmail.toml
- openfang:crates/openfang-extensions/integrations/google-calendar.toml
- openfang:crates/openfang-extensions/integrations/google-drive.toml
- openfang:crates/openfang-extensions/integrations/jira.toml
- openfang:crates/openfang-extensions/integrations/linear.toml
- openfang:crates/openfang-extensions/integrations/mongodb.toml
- openfang:crates/openfang-extensions/integrations/notion.toml
- openfang:crates/openfang-extensions/integrations/postgresql.toml
- openfang:crates/openfang-extensions/integrations/redis.toml
- openfang:crates/openfang-extensions/integrations/sentry.toml
- openfang:crates/openfang-extensions/integrations/slack.toml
- openfang:crates/openfang-extensions/integrations/sqlite-mcp.toml
- openfang:crates/openfang-extensions/integrations/teams-mcp.toml
- openfang:crates/openfang-extensions/integrations/todoist.toml
- openfang:crates/openfang-hands/bundled/browser/HAND.toml
- openfang:crates/openfang-hands/bundled/browser/SKILL.md
- openfang:crates/openfang-hands/bundled/clip/HAND.toml
- openfang:crates/openfang-hands/bundled/clip/SKILL.md
- openfang:crates/openfang-hands/bundled/collector/HAND.toml
- openfang:crates/openfang-hands/bundled/collector/SKILL.md
- openfang:crates/openfang-hands/bundled/lead/HAND.toml
- openfang:crates/openfang-hands/bundled/lead/SKILL.md
- openfang:crates/openfang-hands/bundled/predictor/HAND.toml
- openfang:crates/openfang-hands/bundled/predictor/SKILL.md
- openfang:crates/openfang-hands/bundled/researcher/HAND.toml
- openfang:crates/openfang-hands/bundled/researcher/SKILL.md
- openfang:crates/openfang-hands/bundled/twitter/HAND.toml
- openfang:crates/openfang-hands/bundled/twitter/SKILL.md
- screenpipe:packages/skills/skills/context.md
- screenpipe:packages/skills/skills/digest.md
- screenpipe:packages/skills/skills/recall.md
- screenpipe:packages/skills/skills/search.md

## License Guard Rules

- Never import GPL-licensed upstream code into Kronos core.
- Never import any path under `screenpipe/ee/**`.
- Pluely is referenced for clean-room behavior only in this integration track.
