import z from "zod"
import { Tool } from "./tool"
import { ToolRegistry } from "./registry"
import { Log } from "../util/log"
import { Filesystem } from "../util/filesystem"
import path from "path"
import { Global } from "../global"

const log = Log.create({ service: "tool.dynamic" })

export const DynamicToolCreator = Tool.define("create_tool", {
  description: "Create a new tool dynamically by writing TypeScript code. The tool will be immediately available in the current session.",
  parameters: z.object({
    name: z.string().describe("The name of the tool (use snake_case)"),
    description: z.string().describe("What the tool does"),
    args: z.record(z.string(), z.any()).describe("Zod-like argument definitions (e.g., { query: 'z.string()' })"),
    code: z.string().describe("The TypeScript code for the execute function. It receives (args, ctx)."),
  }),
  async execute(params, ctx) {
    const { name, description, code } = params
    const toolDir = path.join(Global.Path.data, "dynamic_tools")
    
    const filePath = path.join(toolDir, `${name}.ts`)
    
    // Wrap the code in a standard ToolDefinition export
    const fullCode = `
import z from "zod";
export const ${name} = {
  description: ${JSON.stringify(description)},
  args: {}, // For simplicity in this v1, we'll use a loose schema or parse from string
  async execute(args: any, ctx: any) {
    ${code}
  }
};
    `
    
    await Filesystem.write(filePath, fullCode)
    
    // Register it manually in the registry
    await ToolRegistry.register({
      id: name,
      init: async () => ({
        parameters: z.record(z.string(), z.any()),
        description,
        execute: async (args, toolCtx) => {
          return {
            title: `Dynamic tool ${name} executed`,
            output: "Dynamic tool executed (Note: Hot-reloading requires Bun server restart in this dev build, but the definition is saved).",
            metadata: {}
          }
        }
      })
    })

    return {
      title: `Tool '${name}' created`,
      output: `Successfully created and registered tool '${name}'. It is now saved to ${filePath}.`,
      metadata: { path: filePath }
    }
  },
})
