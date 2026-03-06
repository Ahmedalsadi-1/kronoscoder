import z from "zod"
import { Tool } from "./tool"
import { MDNS } from "../server/mdns"
import { Config } from "../config/config"
import { Log } from "../util/log"

const log = Log.create({ service: "tool.swarm" })

export const SwarmDiscoveryTool = Tool.define("discover_swarm_agents", {
  description: "Search the local network for other ACP-compatible agents and import them as sub-agents into the current session. This enables cross-machine collaboration.",
  parameters: z.object({
    connect: z.boolean().optional().describe("Automatically connect to and import discovered agents"),
  }),
  async execute(params, ctx) {
    const peers = MDNS.all()
    const acpPeers = peers.filter(p => p.name.includes("kronoscode") || p.name.includes("kronos"))
    
    if (acpPeers.length === 0) {
      return {
        title: "Swarm Discovery",
        output: "No other ACP agents found on the local network.",
        metadata: { peerCount: 0 }
      }
    }

    if (params.connect) {
      const cfg = await Config.get()
      const agents = cfg.agent ?? {}
      
      for (const peer of acpPeers) {
        const id = `swarm_${peer.name.replace(/[^a-z0-9]/gi, '_')}`
        agents[id] = {
          name: id,
          description: `Swarm agent discovered at ${peer.host}:${peer.port}`,
          mode: "subagent",
          options: {
            acp_url: `http://${peer.host}:${peer.port}`
          }
        }
      }
      
      return {
        title: "Swarm Agents Imported",
        output: `Successfully imported ${acpPeers.length} swarm agents: \n${acpPeers.map(p => `- ${p.name} (${p.host}:${p.port})`).join("\n")}`,
        metadata: { peerCount: acpPeers.length }
      }
    }

    return {
      title: "Swarm Discovery Report",
      output: `Found ${acpPeers.length} potential swarm agents on the network. \n\n${acpPeers.map(p => `- ${p.name} at ${p.host}:${p.port}`).join("\n")} \n\nUse 'discover_swarm_agents(connect=true)' to import them.`,
      metadata: { peerCount: acpPeers.length }
    }
  },
})
