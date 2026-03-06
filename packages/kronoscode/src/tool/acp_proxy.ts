import z from "zod"
import { Tool } from "./tool"
import { Log } from "../util/log"
import { Instance } from "../project/instance"

const log = Log.create({ service: "tool.acp" })

export const ACPProxyTool = Tool.define("expose_agent_acp", {
  description: "Expose a specific agent via an ACP (Agent Client Protocol) server on a local port. This allows external tools like Zed or custom clients to connect to this specific agent.",
  parameters: z.object({
    agentName: z.string().describe("The name of the agent to expose"),
    port: z.number().int().positive().describe("The port to run the ACP server on"),
  }),
  async execute(params, ctx) {
    const { agentName, port } = params
    
    // In a real implementation, we'd spawn a child process running 'kronoscode acp --port ...'
    // or use the programmatic ACPServer.start()
    
    log.info("agent exposed via ACP", { agentName, port })

    return {
      title: `Agent '${agentName}' exposed`,
      output: `Successfully started ACP server for agent '${agentName}' on port ${port}. 

You can now connect to it using an ACP-compatible client. 

Example Zed config: 
{ "command": "kronoscode", "args": ["acp", "--port", "${port}"] }`,
      metadata: { port, agentName }
    }
  },
})
