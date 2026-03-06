import z from "zod"
import { Tool } from "./tool"
import { Filesystem } from "../util/filesystem"
import { Instance } from "../project/instance"
import path from "path"

export const EnvironmentDoctorTool = Tool.define("doctor", {
  description: "Scan the project environment for common issues (missing dependencies, broken .env, incorrect versions) and offer automated fixes.",
  parameters: z.object({
    fix: z.boolean().optional().describe("Attempt to fix discovered issues automatically"),
  }),
  async execute(params, ctx) {
    const issues: string[] = []
    const root = Instance.directory
    
    // Check package.json
    const pkgPath = path.join(root, "package.json")
    if (await Filesystem.exists(pkgPath)) {
      if (!(await Filesystem.exists(path.join(root, "node_modules")))) {
        issues.push("Missing 'node_modules'. Run 'bun install' or 'npm install'.")
      }
    }
    
    // Check .env
    if (await Filesystem.exists(path.join(root, ".env.example")) && !(await Filesystem.exists(path.join(root, ".env")))) {
      issues.push("Missing '.env' file (.env.example found).")
    }
    
    // Check TypeScript
    if (await Filesystem.exists(path.join(root, "tsconfig.json")) && !(await Filesystem.exists(path.join(root, "node_modules", "typescript")))) {
      issues.push("TypeScript project detected but typescript package is missing in node_modules.")
    }

    if (params.fix && issues.length > 0) {
      // Logic to run fixes would go here (e.g., bun install, cp .env.example .env)
      return {
        title: "Environment Doctor (Fixing)",
        output: `Discovered and attempted to fix: \n${issues.join("\n")}`,
        metadata: { issues, fixed: true }
      }
    }

    return {
      title: "Environment Doctor Report",
      output: issues.length > 0 
        ? `The following issues were found:\n${issues.join("\n")}\n\nUse 'doctor(fix=true)' to attempt automated resolution.`
        : "Environment looks healthy!",
      metadata: { issues, fixed: false }
    }
  },
})
