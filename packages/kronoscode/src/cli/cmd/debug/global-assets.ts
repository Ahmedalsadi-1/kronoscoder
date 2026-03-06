import { EOL } from "os"
import { GlobalAssetsMigration } from "../../../migration/global-assets"
import { bootstrap } from "../../bootstrap"
import { cmd } from "../cmd"

export const SyncGlobalAssetsCommand = cmd({
  command: "sync-global-assets",
  describe: "symlink global skills and agents into ~/.kronoscode",
  builder: (yargs) =>
    yargs
      .option("dry-run", {
        type: "boolean",
        default: false,
        describe: "show planned actions without writing symlinks or manifest",
      })
      .option("force", {
        type: "boolean",
        default: false,
        describe: "replace existing conflicting targets under ~/.kronoscode",
      })
      .option("json", {
        type: "boolean",
        default: false,
        describe: "print machine-readable output",
      })
      .option("include-system", {
        type: "boolean",
        default: false,
        describe: "include ~/.codex/skills/.system entries",
      }),
  async handler(args) {
    await bootstrap(process.cwd(), async () => {
      const result = await GlobalAssetsMigration.sync({
        dryRun: Boolean(args["dry-run"]),
        force: Boolean(args.force),
        includeSystem: Boolean(args["include-system"]),
      })

      if (args.json) {
        process.stdout.write(JSON.stringify(result, null, 2) + EOL)
        return
      }

      process.stdout.write(
        "External source scanning remains enabled for compatibility; this command creates canonical ~/.kronoscode symlinks." +
          EOL,
      )
      process.stdout.write(
        `Mode: ${result.dryRun ? "dry-run (no writes)" : "apply"} | force=${result.force ? "on" : "off"} | include-system=${result.includeSystem ? "on" : "off"}` +
          EOL,
      )
      process.stdout.write(`Scanned: ${result.summary.scanned}` + EOL)
      process.stdout.write(`Selected: ${result.summary.selected}` + EOL)
      process.stdout.write(`Linked: ${result.summary.linked}` + EOL)
      process.stdout.write(`Skipped: ${result.summary.skipped}` + EOL)
      process.stdout.write(`Conflicts: ${result.summary.conflicts}` + EOL)
      process.stdout.write(`Manifest: ${result.paths.manifest}${result.dryRun ? " (not written in dry-run)" : ""}` + EOL)

      if (result.summary.conflicts > 0) {
        process.stdout.write(EOL + "Conflicts:" + EOL)
        for (const item of result.assets.filter((entry) => entry.status === "conflict")) {
          process.stdout.write(`- ${item.targetPath} <- ${item.sourcePath} (${item.reason ?? "conflict"})` + EOL)
        }
      }
    })
  },
})
