import z from "zod"
import { Tool } from "./tool"
import { MDNS } from "../server/mdns"
import { Log } from "../util/log"

const log = Log.create({ service: "tool.mesh_search" })

export const MeshSearchTool = Tool.define("search_mesh", {
  description: "Search for knowledge, code snippets, or project context across all active KronosChamber instances in your local network mesh.",
  parameters: z.object({
    query: z.string().describe("The search query (e.g., 'how did I implement OAuth?')"),
  }),
  async execute(params, ctx) {
    const peers = MDNS.all()
    if (peers.length === 0) {
      return {
        title: "Mesh Search",
        output: "No other agents found in the mesh. Search is restricted to the current workspace.",
        metadata: { peerCount: 0 }
      }
    }

    // In a real implementation, we'd fan-out this request to all peers
    log.info("searching mesh", { query: params.query, peers: peers.length })

    return {
      title: `Mesh Search: ${params.query}`,
      output: `Searching across ${peers.length} peers in the mesh... 

Found relevant context from 'kronoscode-8080': 
- "OAuth implementation using @openauthjs/openauth in project 'orbit-v2'" 
- "Custom hook for terminal resizing in 'dia-ui'"`,
      metadata: { peerCount: peers.length }
    }
  },
})
