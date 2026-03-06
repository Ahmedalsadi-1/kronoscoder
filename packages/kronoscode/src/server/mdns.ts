import { Log } from "@/util/log"
import { Bonjour, type Service } from "bonjour-service"

const log = Log.create({ service: "mdns" })

export namespace MDNS {
  let bonjour: Bonjour | undefined
  let currentPort: number | undefined
  const peers = new Map<string, { name: string; host: string; port: number }>()

  export function publish(port: number, domain?: string) {
    if (currentPort === port) return
    if (bonjour) unpublish()

    try {
      const host = domain ?? "kronoscode.local"
      const name = `kronoscode-${port}`
      bonjour = new Bonjour()
      
      const service = bonjour.publish({
        name,
        type: "http",
        host,
        port,
        txt: { path: "/", kronoscode: "true" },
      })

      service.on("up", () => {
        log.info("mDNS service published", { name, port })
      })

      service.on("error", (err) => {
        log.error("mDNS service error", { error: err })
      })

      // Start browsing for peers
      const browser = bonjour.find({ type: "http" })
      browser.on("up", (s: Service) => {
        if (s.txt?.kronoscode === "true" && s.name !== name && s.referer) {
          peers.set(s.name, { name: s.name, host: s.referer.address, port: s.port })
          log.info("peer discovered", { name: s.name, host: s.referer.address })
        }
      })
      browser.on("down", (s: Service) => {
        peers.delete(s.name)
      })

      currentPort = port
    } catch (err) {
      log.error("mDNS publish failed", { error: err })
      if (bonjour) {
        try {
          bonjour.destroy()
        } catch {}
      }
      bonjour = undefined
      currentPort = undefined
    }
  }

  export function all() {
    return Array.from(peers.values())
  }

  export function unpublish() {
    if (bonjour) {
      try {
        bonjour.unpublishAll()
        bonjour.destroy()
      } catch (err) {
        log.error("mDNS unpublish failed", { error: err })
      }
      bonjour = undefined
      currentPort = undefined
      log.info("mDNS service unpublished")
    }
  }
}
