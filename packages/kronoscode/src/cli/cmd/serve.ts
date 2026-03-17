import { Server } from "../../server/server"
import { cmd } from "./cmd"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { Flag } from "../../flag/flag"
import { autoStartScreenpipe } from "../../tool/screenpipe_auto_start"

export const ServeCommand = cmd({
  command: "serve",
  builder: (yargs) => withNetworkOptions(yargs),
  describe: "starts a headless kronoscode server",
  handler: async (args) => {
    if (!Flag.KRONOSCODE_SERVER_PASSWORD) {
      console.log("Warning: KRONOSCODE_SERVER_PASSWORD is not set; server is unsecured.")
    }
    if (Flag.KRONOSCODE_AUTO_START_SCREENPIPE) {
      autoStartScreenpipe().catch(() => {})
    }
    const opts = await resolveNetworkOptions(args)
    const server = Server.listen(opts)
    console.log(`kronoscode server listening on http://${server.hostname}:${server.port}`)
    await new Promise(() => {})
    await server.stop()
  },
})
