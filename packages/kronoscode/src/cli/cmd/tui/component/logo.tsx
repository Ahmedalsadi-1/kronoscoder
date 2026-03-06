import { RGBA, TextAttributes } from "@opentui/core"
import { createSignal, onCleanup, For, createMemo } from "solid-js"
import { useTheme, tint } from "@tui/context/theme"

export type LogoEmotion = "neutral" | "happy" | "focused" | "worried"

export function Logo(props: { emotion?: LogoEmotion }) {
  const { theme } = useTheme()
  const title = tint(theme.text, theme.primary, 0.35)
  const [angle, setAngle] = createSignal(0)
  const webPort =
    process.env.KRONOSCHAMBER_PORT ||
    process.env.OPENCHAMBER_PORT ||
    "3001"
  const apiPort =
    process.env.KRONOSCODE_PORT ||
    process.env.OPENCODE_PORT ||
    "4096"

  // Animation loop for 360 rotation (Slowed down)
  const timer = setInterval(() => {
    setAngle((a) => (a + 0.04) % (Math.PI * 2))
  }, 60)
  onCleanup(() => clearInterval(timer))

  const getMascot = (emotion: LogoEmotion = "neutral") => {
    const eyes = emotion === "happy" ? "^           ^" : emotion === "focused" ? "ò           ó" : emotion === "worried" ? ">           <" : "●           ●"
    const mouth = emotion === "happy" ? "\\_______/" : emotion === "focused" ? "  -----  " : emotion === "worried" ? "  ~~~~~  " : "    ▼    "
    
    return [
      "  / \\       / \\  ",
      " /   \\     /   \\ ",
      "/     \\___/     \\",
      "/                 \\",
      "/___________________\\",
      "|                     |",
      `|    ${eyes}    |`,
      `|      ${mouth}      |`,
      "|        / v \\        |",
      "____|_______/_____\\_______|____",
      "/    |                     |    \\",
      "/     |                     |     \\",
      "\\____/|_____________________|\\____/",
    ]
  }

  const wordmark = [
    "  _  __ ____   ___  _   _  ___  ____   ____ ___  ____  _____",
    " | |/ /|  _ \\ / _ \\| \\ | |/ _ \\/ ___| / ___/ _ \\|  _ \\| ____|",
    " | ' / | |_) | | | |  \\| | | | \\___ \\| |  | | | | | | |  _|",
    " | . \\ |  _ <| |_| | |\\  | |_| |___) | |__| |_| | |_| | |___",
    " |_|\\_\\|_| \\_\\\\___/|_| \\_|\\___/|____/ \\____\\___/|____/|_____|",
  ]

  const rotatedMascot = createMemo(() => {
    const a = angle()
    const cos = Math.cos(a)
    const isBack = cos < 0
    const scale = Math.abs(cos)
    const currentMascot = getMascot(props.emotion)
    
    return currentMascot.map((line) => {
      let transformed = line
      
      // Flip characters if we're looking at the back
      if (isBack) {
        transformed = transformed
          .split("")
          .map((c) => {
            if (c === "/") return "\\"
            if (c === "\\") return "/"
            if (c === "(") return ")"
            if (c === ")") return "("
            return c
          })
          .reverse()
          .join("")
      }

      // Center the line and apply width scale
      const width = line.length
      const targetWidth = Math.max(1, Math.round(width * scale))
      const padding = Math.floor((width - targetWidth) / 2)
      
      return " ".repeat(padding) + transformed.slice(0, targetWidth).padEnd(targetWidth) + " ".repeat(padding)
    })
  })

  return (
    <box flexDirection="column" alignItems="center">
      <box flexDirection="column">
        <For each={rotatedMascot()}>
          {(line) => (
            <text fg={theme.primary} selectable={false} wrapMode="none">
              {line}
            </text>
          )}
        </For>
      </box>
      <box height={1} />
      <box flexDirection="column">
        <For each={wordmark}>
          {(line) => (
            <text fg={title} attributes={TextAttributes.BOLD} selectable={false} wrapMode="none">
              {line}
            </text>
          )}
        </For>
      </box>
      <box height={1} />
      <box flexDirection="column" alignItems="center">
        <text fg={theme.text_muted}>
          Web UI:             <span style={{ fg: theme.primary, attributes: TextAttributes.UNDERLINE }}>{`http://127.0.0.1:${webPort}/`}</span>
        </text>
        <text fg={theme.text_muted}>
          Runtime API:        <span style={{ fg: theme.primary, attributes: TextAttributes.UNDERLINE }}>{`http://127.0.0.1:${apiPort}/`}</span>
        </text>
      </box>
    </box>
  )
}
