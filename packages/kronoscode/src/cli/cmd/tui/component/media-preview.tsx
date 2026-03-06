import { BoxRenderable, RGBA } from "@opentui/core"
import { TextureUtils } from "@opentui/core/3d"
import { useRenderer } from "@opentui/solid"
import { useTheme } from "@tui/context/theme"
import type { MediaItem } from "@tui/util/media-extract"
import { clear as clearKitty, nextPlacement, put as putKitty, upload as uploadKitty } from "@tui/util/kitty-graphics"
import { resolveMedia } from "@tui/util/media-resolve"
import { extractVideoFrame } from "@tui/util/video-frame"
import { Link } from "@tui/ui/link"
import { Locale } from "@/util/locale"
import { createEffect, createMemo, createResource, createSignal, For, Match, onCleanup, Show, Switch } from "solid-js"

export type MediaRenderMode = "kitty" | "rgb" | "ascii"

type RGB = [number, number, number]

type RGBSegment = {
  text: string
  top: RGB
  bottom: RGB
}

type PreviewData = {
  mode: MediaRenderMode
  rgb?: RGBSegment[][]
  ascii?: string[]
  kitty?: {
    key: string
    path: string
  }
  warning?: string
  error?: string
}

const ramp = " .:-=+*#%@"
const cache = new Map<string, PreviewData>()

function modeFromCapabilities(input: {
  preferred: "auto" | MediaRenderMode
  kittyGraphics: boolean
  rgb: boolean
}) {
  if (input.preferred === "ascii") return "ascii"
  if (input.preferred === "rgb") return "rgb"
  if (input.preferred === "kitty") return input.kittyGraphics ? "kitty" : input.rgb ? "rgb" : "ascii"
  if (input.kittyGraphics) return "kitty"
  if (input.rgb) return "rgb"
  return "ascii"
}

function nearest(image: { data: Uint8Array; width: number; height: number }, x: number, y: number, width: number, height: number): RGB {
  const sx = Math.min(image.width - 1, Math.floor(((x + 0.5) / width) * image.width))
  const sy = Math.min(image.height - 1, Math.floor(((y + 0.5) / height) * image.height))
  const i = (sy * image.width + sx) * 4
  return [image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0]
}

function toAscii(image: { data: Uint8Array; width: number; height: number }, width: number, height: number) {
  return Array.from({ length: height }, (_, y) => {
    return Array.from({ length: width }, (_, x) => {
      const [r, g, b] = nearest(image, x, y, width, height)
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
      const slot = Math.round((lum / 255) * (ramp.length - 1))
      return ramp[slot] ?? " "
    }).join("")
  })
}

function toRgbBlocks(image: { data: Uint8Array; width: number; height: number }, width: number, height: number) {
  return Array.from({ length: Math.ceil(height / 2) }, (_, row) => {
    const yTop = row * 2
    const yBottom = Math.min(height - 1, yTop + 1)

    const segments: RGBSegment[] = []
    for (let x = 0; x < width; x++) {
      const top = nearest(image, x, yTop, width, height)
      const bottom = nearest(image, x, yBottom, width, height)
      const last = segments.at(-1)
      if (
        last &&
        last.top[0] === top[0] &&
        last.top[1] === top[1] &&
        last.top[2] === top[2] &&
        last.bottom[0] === bottom[0] &&
        last.bottom[1] === bottom[1] &&
        last.bottom[2] === bottom[2]
      ) {
        last.text += "▀"
      }
      if (!last || last.top[0] !== top[0] || last.top[1] !== top[1] || last.top[2] !== top[2] || last.bottom[0] !== bottom[0] || last.bottom[1] !== bottom[1] || last.bottom[2] !== bottom[2]) {
        segments.push({ text: "▀", top, bottom })
      }
    }

    return segments
  })
}

async function buildPreview(input: {
  item: MediaItem
  mode: MediaRenderMode
  width: number
  height: number
}): Promise<PreviewData> {
  const key = `${input.item.id}:${input.mode}:${input.width}:${input.height}`
  const cached = cache.get(key)
  if (cached) return cached

  const resolved = await resolveMedia(input.item)
  if (!resolved.localPath) {
    const failed: PreviewData = {
      mode: input.mode,
      error: `Media source resolution failed: ${resolved.error ?? "unknown error"}`,
    }
    cache.set(key, failed)
    return failed
  }

  let localPath = resolved.localPath
  let warning: string | undefined

  if (input.item.kind === "video") {
    const frame = await extractVideoFrame(localPath, input.item.id, input.width * 2)
    if (!frame.output) {
      const failed: PreviewData = {
        mode: input.mode,
        warning: frame.error,
        error: `Video frame extraction failed: ${frame.error ?? "ffmpeg is required for video previews"}`,
      }
      cache.set(key, failed)
      return failed
    }
    localPath = frame.output
    warning = frame.error
  }

  if (input.mode === "kitty") {
    const preview: PreviewData = {
      mode: input.mode,
      warning,
      kitty: {
        key: `${input.item.id}:${localPath}`,
        path: localPath,
      },
    }
    cache.set(key, preview)
    return preview
  }

  const texture = await TextureUtils.fromFile(localPath)
  if (!texture) {
    const failed: PreviewData = {
      mode: input.mode,
      warning,
      error: `Image decode failed: ${localPath}`,
    }
    cache.set(key, failed)
    return failed
  }

  const image = texture.image as { data: Uint8Array; width: number; height: number }
  const preview: PreviewData =
    input.mode === "ascii"
      ? {
          mode: input.mode,
          warning,
          ascii: toAscii(image, input.width, input.height),
        }
      : {
          mode: input.mode,
          warning,
          rgb: toRgbBlocks(image, input.width, input.height),
        }

  cache.set(key, preview)
  return preview
}

function KittyViewport(props: { path: string; keyID: string; width: number; height: number }) {
  const renderer = useRenderer()
  const { theme } = useTheme()
  const placementID = nextPlacement()
  let drawn = ""
  let imageID: number | undefined
  let previousID: number | undefined

  const [upload] = createResource(
    () => `${props.keyID}:${props.path}`,
    async () => uploadKitty({ key: `${props.keyID}:${props.path}`, path: props.path }),
  )

  createEffect(() => {
    const item = upload()
    if (!item?.imageID) return
    if (previousID && previousID !== item.imageID) {
      clearKitty({ imageID: previousID, placementID })
      drawn = ""
    }
    imageID = item.imageID
    previousID = item.imageID
  })

  onCleanup(() => {
    if (!imageID) return
    clearKitty({ imageID, placementID })
  })

  return (
    <box flexDirection="column" gap={1}>
      <Show when={upload()?.error}>
        <text fg={theme.error}>{upload()?.error}</text>
      </Show>
      <box
        width={props.width}
        height={props.height}
        backgroundColor={theme.background}
        renderAfter={function () {
          if (!renderer.capabilities?.kitty_graphics) return
          if (!imageID) return
          const el = this as BoxRenderable
          const signature = `${imageID}:${el.x}:${el.y}:${el.width}:${el.height}`
          if (signature === drawn) return
          putKitty({
            imageID,
            placementID,
            x: el.x,
            y: el.y,
            width: el.width,
            height: el.height,
            z: 12,
          })
          drawn = signature
        }}
      />
    </box>
  )
}

function Frame(props: {
  preview?: PreviewData
  width: number
  height: number
  theme: ReturnType<typeof useTheme>["theme"]
}) {
  return (
    <Switch>
      <Match when={props.preview?.error}>
        <text fg={props.theme.error}>{props.preview?.error}</text>
      </Match>
      <Match when={props.preview?.kitty}>
        <Show when={props.preview?.kitty}>
          {(item) => <KittyViewport path={item().path} keyID={item().key} width={props.width} height={props.height} />}
        </Show>
      </Match>
      <Match when={props.preview?.ascii}>
        <box flexDirection="column">
          <For each={props.preview?.ascii ?? []}>
            {(line) => (
              <text wrapMode="none" fg={props.theme.text}>
                {line}
              </text>
            )}
          </For>
        </box>
      </Match>
      <Match when={props.preview?.rgb}>
        <box flexDirection="column">
          <For each={props.preview?.rgb ?? []}>
            {(line) => (
              <text wrapMode="none" selectable={false}>
                <For each={line}>
                  {(segment) => (
                    <span
                      style={{
                        fg: RGBA.fromInts(segment.top[0], segment.top[1], segment.top[2]),
                        bg: RGBA.fromInts(segment.bottom[0], segment.bottom[1], segment.bottom[2]),
                      }}
                    >
                      {segment.text}
                    </span>
                  )}
                </For>
              </text>
            )}
          </For>
        </box>
      </Match>
    </Switch>
  )
}

export function MediaPreview(props: {
  item?: MediaItem
  width: number
  preferredMode: "auto" | MediaRenderMode
  quality?: "max" | "balanced"
  chrome?: boolean
  motion?: boolean
  highContrast?: boolean
}) {
  const renderer = useRenderer()
  const { theme } = useTheme()
  const [pulse, setPulse] = createSignal(0)

  createEffect(() => {
    if (props.motion === false) return
    const timer = setInterval(() => {
      setPulse((x) => (x + 1) % 3)
    }, 160)
    onCleanup(() => clearInterval(timer))
  })

  const targetWidth = createMemo(() => {
    const raw = props.quality === "max" ? props.width - 10 : Math.min(props.width - 12, 64)
    return Math.max(24, raw)
  })

  const targetHeight = createMemo(() => {
    if (props.quality === "max") return 28
    return 18
  })

  const mode = createMemo(() => {
    return modeFromCapabilities({
      preferred: props.preferredMode,
      kittyGraphics: !!renderer.capabilities?.kitty_graphics,
      rgb: !!renderer.capabilities?.rgb,
    })
  })

  const [preview] = createResource(
    () => (props.item ? `${props.item.id}:${mode()}:${targetWidth()}:${targetHeight()}` : undefined),
    async () => {
      if (!props.item) return
      return buildPreview({
        item: props.item,
        mode: mode(),
        width: targetWidth(),
        height: targetHeight(),
      })
    },
  )

  const forcedKittyFallback = createMemo(() => {
    if (props.preferredMode !== "kitty") return
    if (renderer.capabilities?.kitty_graphics) return
    const fallback = renderer.capabilities?.rgb ? "rgb" : "ascii"
    return `Kitty graphics requested, but terminal kitty_graphics capability is unavailable. Falling back to ${fallback}.`
  })

  const browserTitle = createMemo(() => {
    if (!props.item) return "about:blank"
    if (props.item.title) return props.item.title
    if (props.item.url_hint) return props.item.url_hint
    if (props.item.filename) return props.item.filename
    if (props.item.tool) return props.item.tool
    return "about:blank"
  })

  const browserURL = createMemo(() => {
    if (!props.item) return "about:blank"
    if (props.item.url_hint) return props.item.url_hint
    if (props.item.url.startsWith("http://") || props.item.url.startsWith("https://")) return props.item.url
    if (props.item.filename) return `file://${props.item.filename}`
    if (props.item.tool) return `tool://${props.item.tool}`
    return "about:blank"
  })

  const loading = createMemo(() => {
    if (props.motion === false) return "Rendering preview"
    return `Rendering preview${".".repeat(pulse() + 1)}`
  })

  const clickableURL = createMemo(() => {
    const value = browserURL()
    if (/^(https?:\/\/|file:\/\/)/i.test(value)) return value
    return null
  })

  return (
    <box flexDirection="column" gap={1}>
      <Show when={props.item} fallback={<text fg={theme.textMuted}>No browser media yet.</text>}>
        <Show
          when={props.chrome !== false}
          fallback={
            <text fg={theme.textMuted}>
              <span style={{ fg: theme.text }}>{props.item?.filename ?? props.item?.tool}</span>
              <span> · {props.item?.mime}</span>
              <span> · mode {mode()}</span>
            </text>
          }
        >
          <box
            flexDirection="column"
            border={true}
            borderColor={props.highContrast ? theme.border_strong : theme.border_subtle}
            backgroundColor={theme.surface_base}
          >
            <box
              flexDirection="row"
              backgroundColor={theme.surface_elev_1}
              paddingLeft={1}
              paddingRight={1}
              gap={1}
              minHeight={1}
            >
              <text fg={theme.error}>●</text>
              <text fg={theme.warning}>●</text>
              <text fg={theme.success}>●</text>
              <text fg={theme.textMuted}>│</text>
              <text fg={theme.text_secondary}>◀</text>
              <text fg={theme.text_secondary}>▶</text>
              <text fg={theme.text_secondary}>⟳</text>
              <text fg={theme.textMuted}>│</text>
              <box backgroundColor={theme.surface_elev_2} paddingLeft={1} paddingRight={1} flexGrow={1}>
                <Show
                  when={clickableURL()}
                  fallback={
                    <text fg={theme.text_primary} wrapMode="none">
                      {browserURL()}
                    </text>
                  }
                >
                  {(href) => (
                    <Link href={href()} fg={theme.text_primary}>
                      {browserURL()}
                    </Link>
                  )}
                </Show>
              </box>
            </box>
            <box
              flexDirection="row"
              paddingLeft={1}
              paddingRight={1}
              paddingTop={1}
              gap={1}
              backgroundColor={theme.surface_base}
            >
              <Show
                when={clickableURL()}
                fallback={
                  <text fg={theme.text_primary} wrapMode="none" width="100%">
                    {browserTitle()}
                  </text>
                }
              >
                {(href) => (
                  <Link href={href()} fg={theme.text_primary}>
                    {browserTitle()}
                  </Link>
                )}
              </Show>
            </box>
            <box
              flexDirection="row"
              paddingLeft={1}
              paddingRight={1}
              paddingBottom={1}
              gap={1}
              backgroundColor={theme.surface_base}
            >
              <text fg={theme.text_muted}>
                {props.item?.kind.toUpperCase()} · {props.item?.mime} · mode {mode()}
                <Show when={props.item?.page_id}>
                  <span> · page {props.item?.page_id}</span>
                </Show>
                <span> · {Locale.todayTimeOrDateTime(props.item?.time ?? Date.now())}</span>
              </text>
            </box>
          </box>
        </Show>

        <Show when={preview.loading}>
          <text fg={theme.text_muted}>{loading()}</text>
        </Show>

        <Show when={forcedKittyFallback()}>
          <text fg={theme.accent_warning}>{forcedKittyFallback()}</text>
        </Show>

        <Show when={preview()?.warning}>
          <text fg={theme.accent_warning}>Preview warning: {preview()?.warning}</text>
        </Show>

        <Frame preview={preview()} width={targetWidth()} height={targetHeight()} theme={theme} />
      </Show>
    </box>
  )
}
