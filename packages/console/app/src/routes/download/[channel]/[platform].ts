import type { APIEvent } from "@solidjs/start"
import type { DownloadPlatform } from "../types"

const assetNames: Record<string, string> = {
  "darwin-aarch64-dmg": "kronoscode-desktop-darwin-aarch64.dmg",
  "darwin-x64-dmg": "kronoscode-desktop-darwin-x64.dmg",
  "windows-x64-nsis": "kronoscode-desktop-windows-x64.exe",
  "linux-x64-deb": "kronoscode-desktop-linux-amd64.deb",
  "linux-x64-appimage": "kronoscode-desktop-linux-amd64.AppImage",
  "linux-x64-rpm": "kronoscode-desktop-linux-x86_64.rpm",
} satisfies Record<DownloadPlatform, string>

// Doing this on the server lets us preserve the original name for platforms we don't care to rename for
const downloadNames: Record<string, string> = {
  "darwin-aarch64-dmg": "KronosCode Desktop.dmg",
  "darwin-x64-dmg": "KronosCode Desktop.dmg",
  "windows-x64-nsis": "KronosCode Desktop Installer.exe",
} satisfies { [K in DownloadPlatform]?: string }

export async function GET({ params: { platform, channel } }: APIEvent) {
  const assetName = assetNames[platform]
  if (!assetName) return new Response("Not Found", { status: 404 })

  const resp = await fetch(
    `https://github.com/anomalyco/${channel === "stable" ? "kronoscode" : "kronoscode-beta"}/releases/latest/download/${assetName}`,
    {
      cf: {
        // in case gh releases has rate limits
        cacheTtl: 60 * 5,
        cacheEverything: true,
      },
    } as any,
  )

  const downloadName = downloadNames[platform]

  const headers = new Headers(resp.headers)
  if (downloadName) headers.set("content-disposition", `attachment; filename="${downloadName}"`)

  return new Response(resp.body, { ...resp, headers })
}
