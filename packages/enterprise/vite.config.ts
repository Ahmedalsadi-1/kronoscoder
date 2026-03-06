import { defineConfig, PluginOption } from "vite"
import { solidStart } from "@solidjs/start/config"
import { nitro } from "nitro/vite"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const nitroConfig: any = (() => {
  const target = process.env.KRONOSCODE_DEPLOYMENT_TARGET
  if (target === "cloudflare") {
    return {
      compatibilityDate: "2024-09-19",
      preset: "cloudflare_module",
      cloudflare: {
        nodeCompat: true,
      },
    }
  }
  return {}
})()

export default defineConfig({
  resolve: {
    alias: [
      { find: "@kronoscode-ai/ui", replacement: path.resolve(__dirname, "src/ui-compat") },
    ],
  },
  plugins: [
    tailwindcss(),
    solidStart() as PluginOption,
    nitro({
      ...nitroConfig,
      baseURL: process.env.KRONOSCODE_BASE_URL,
    }),
  ],
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
  worker: {
    format: "es",
  },
})
