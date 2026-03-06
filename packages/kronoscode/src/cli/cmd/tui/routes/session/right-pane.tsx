import { For, Show, createMemo } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { TextAttributes } from "@opentui/core"
import type { MediaItem, MediaKind } from "@tui/util/media-extract"
import { MediaPreview, type MediaRenderMode } from "@tui/component/media-preview"
import { Sidebar } from "./sidebar"
import { Locale } from "@/util/locale"
import type { Snapshot } from "@/snapshot"
import { groups as diffGroups, patch as sessionPatch, sort as sortDiffs, stats as diffStats } from "@tui/util/session-diff"
import { LANGUAGE_EXTENSIONS } from "@/lsp/language"
import path from "path"
import open from "open"

export type RightPaneTab = "context" | "media" | "diffs" | "thoughts"

const TAB_ORDER: RightPaneTab[] = ["context", "media", "diffs", "thoughts"]
const TAB_TITLE: Record<RightPaneTab, string> = {
  context: "Context",
  media: "Browser",
  diffs: "Diffs",
  thoughts: "Thoughts",
}

function mediaIcon(kind: MediaKind) {
  if (kind === "video") return "VID"
  return "IMG"
}

function filetype(input?: string) {
  if (!input) return "none"
  const ext = path.extname(input)
  const language = LANGUAGE_EXTENSIONS[ext]
  if (["typescriptreact", "javascriptreact", "javascript"].includes(language)) return "typescript"
  return language
}

function status(item: Snapshot.FileDiff) {
  return item.status ?? "modified"
}

function statusIcon(input: Snapshot.FileDiff["status"]) {
  if (input === "added") return "+"
  if (input === "deleted") return "-"
  return "~"
}

function statusLabel(input: Snapshot.FileDiff["status"]) {
  if (input === "added") return "Added"
  if (input === "deleted") return "Deleted"
  return "Modified"
}

export function RightPane(props: {
  sessionID: string
  width: number
  tab: RightPaneTab
  onTabChange: (tab: RightPaneTab) => void
  mediaItems: MediaItem[]
  selectedID?: string
  onSelect: (id: string) => void
  diffItems: Snapshot.FileDiff[]
  selectedDiffFile?: string
  onSelectDiff: (file: string) => void
  diffWrapMode: "word" | "none"
  diffStyle?: "auto" | "stacked"
  mode: "auto" | MediaRenderMode
  quality: "max" | "balanced"
  chrome?: boolean
  motion?: boolean
  highContrast?: boolean
  density?: "compact" | "comfortable" | "detailed"
}) {
  const { theme, syntax } = useTheme()

  const sortedDiffs = createMemo(() => sortDiffs(props.diffItems))
  const groupedDiffs = createMemo(() => diffGroups(props.diffItems))
  const diffTotals = createMemo(() => diffStats(props.diffItems))
  const groupTotals = createMemo(() => ({
    added: groupedDiffs().added.length,
    modified: groupedDiffs().modified.length,
    deleted: groupedDiffs().deleted.length,
  }))

  const selected = createMemo(() => {
    const picked = props.mediaItems.find((item) => item.id === props.selectedID)
    if (picked) return picked
    return props.mediaItems.at(-1)
  })

  const selectedDiff = createMemo(() => {
    const picked = sortedDiffs().find((item) => item.file === props.selectedDiffFile)
    if (picked) return picked
    return sortedDiffs().at(-1)
  })

  const selectedPatch = createMemo(() => {
    const picked = selectedDiff()
    if (!picked) return
    return sessionPatch(picked)
  })

  const diffView = createMemo(() => {
    if (props.diffStyle === "stacked") return "unified"
    return props.width > 86 ? "split" : "unified"
  })
  const mediaListHeight = createMemo(() => {
    if (props.density === "compact") return 6
    if (props.density === "detailed") return 10
    return 8
  })
  const diffListHeight = createMemo(() => {
    if (props.density === "compact") return 7
    if (props.density === "detailed") return 11
    return 9
  })
  const edgeColor = createMemo(() => (props.highContrast ? theme.border_strong : theme.border_subtle))

  const statusLine = createMemo(() => {
    if (props.tab === "media") {
      const item = selected()
      if (!item) return "No browser captures"
      return `${mediaIcon(item.kind)} ${item.mime} · ${Locale.todayTimeOrDateTime(item.time)}`
    }
    if (props.tab === "diffs") {
      const total = diffTotals()
      return `${total.files} files · +${total.additions} -${total.deletions}`
    }
    return "Session context"
  })

  const accentForStatus = (input: Snapshot.FileDiff["status"]) => {
    if (input === "added") return theme.accent_success
    if (input === "deleted") return theme.accent_error
    return theme.accent_primary
  }

  const openMediaSource = (item: MediaItem) => {
    const target = item.url_hint ?? (item.url.startsWith("http://") || item.url.startsWith("https://") ? item.url : null)
    if (!target) return
    open(target).catch(() => {})
  }

  return (
    <box width={props.width} height="100%" backgroundColor={theme.surface_base} border={["left"]} borderColor={edgeColor()}>
      <box flexDirection="column" width="100%" height="100%">
        <box
          flexDirection="row"
          paddingLeft={1}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
          gap={1}
          backgroundColor={theme.surface_elev_1}
          border={["bottom"]}
          borderColor={edgeColor()}
        >
          <For each={TAB_ORDER}>
            {(tab) => (
              <box
                width={13}
                onMouseUp={() => props.onTabChange(tab)}
                backgroundColor={props.tab === tab ? theme.surface_elev_2 : theme.surface_elev_1}
                border={true}
                borderColor={props.tab === tab ? theme.border_strong : edgeColor()}
                paddingLeft={1}
                paddingRight={1}
              >
                <text fg={props.tab === tab ? theme.text_primary : theme.text_muted} wrapMode="none">
                  <span style={{ bold: props.tab === tab }}>{TAB_TITLE[tab]}</span>{" "}
                  <span style={{ fg: theme.text_secondary }}>
                    {tab === "media" ? props.mediaItems.length : tab === "diffs" ? props.diffItems.length : ""}
                  </span>
                </text>
              </box>
            )}
          </For>
        </box>

        <box
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          backgroundColor={theme.surface_elev_2}
          border={["bottom"]}
          borderColor={edgeColor()}
        >
          <text fg={theme.text_secondary} wrapMode="none">
            {statusLine()}
          </text>
        </box>

        <Show when={props.tab === "context"}>
          <Sidebar sessionID={props.sessionID} width={props.width} compact />
        </Show>

        <Show when={props.tab === "media"}>
          <box flexDirection="column" flexGrow={1} minHeight={0} paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
            <box flexGrow={1} minHeight={0}>
              <scrollbox
                viewportOptions={{
                  paddingRight: 1,
                }}
                verticalScrollbarOptions={{
                  trackOptions: {
                    backgroundColor: theme.surface_elev_1,
                    foregroundColor: edgeColor(),
                  },
                }}
              >
                <MediaPreview
                  item={selected()}
                  width={props.width}
                  preferredMode={props.mode}
                  quality={props.quality}
                  chrome={props.chrome}
                  motion={props.motion}
                  highContrast={props.highContrast}
                />
              </scrollbox>
            </box>

            <Show when={props.mediaItems.length > 0}>
              <box flexDirection="column" gap={1}>
                <text fg={theme.text_secondary}>Browser captures</text>
                <scrollbox
                  height={mediaListHeight()}
                  viewportOptions={{
                    paddingRight: 1,
                  }}
                  verticalScrollbarOptions={{
                    trackOptions: {
                      backgroundColor: theme.surface_elev_1,
                      foregroundColor: edgeColor(),
                    },
                  }}
                >
                  <box flexDirection="column" gap={1}>
                    <For each={props.mediaItems}>
                      {(item) => (
                        <box
                          onMouseUp={() => props.onSelect(item.id)}
                          border={["left"]}
                          borderColor={item.id === selected()?.id ? theme.focus_ring : theme.surface_elev_2}
                          paddingLeft={1}
                          paddingRight={1}
                          backgroundColor={item.id === selected()?.id ? theme.surface_elev_2 : theme.surface_base}
                          justifyContent="space-between"
                        >
                          <text fg={item.id === selected()?.id ? theme.text_primary : theme.text_muted} wrapMode="none">
                            {mediaIcon(item.kind)} {item.filename ?? item.title ?? item.tool} ·{" "}
                            {Locale.todayTimeOrDateTime(item.time)}
                          </text>
                          <text fg={theme.accent_primary} onMouseUp={() => openMediaSource(item)}>
                            Open
                          </text>
                        </box>
                      )}
                    </For>
                  </box>
                </scrollbox>
              </box>
            </Show>

            <Show when={props.mediaItems.length === 0}>
              <text fg={theme.text_muted}>No browser screenshots or video captures detected yet.</text>
            </Show>
          </box>
        </Show>

        <Show when={props.tab === "thoughts"}>
          <box flexDirection="column" flexGrow={1} minHeight={0} paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
            <text fg={theme.text_primary} attributes={TextAttributes.BOLD}>Agent Reasoning Map</text>
            <scrollbox
              verticalScrollbarOptions={{
                trackOptions: {
                  backgroundColor: theme.surface_elev_1,
                  foregroundColor: edgeColor(),
                },
              }}
            >
              <box flexDirection="column" gap={1}>
                <box border={["left"]} borderColor={theme.accent_primary} paddingLeft={1} marginBottom={1}>
                  <text fg={theme.text_primary}>Initial Discovery</text>
                  <text fg={theme.text_muted} wrapMode="word">Analyzing project structure and identifying entry points...</text>
                </box>
                <box border={["left"]} borderColor={theme.accent_primary} paddingLeft={1} marginBottom={1}>
                  <text fg={theme.text_primary}>Tool Selection</text>
                  <text fg={theme.text_muted} wrapMode="word">Choosing 'grep_search' to locate terminal implementation.</text>
                </box>
                <box border={["left"]} borderColor={theme.accent_primary} paddingLeft={1}>
                  <text fg={theme.text_primary}>Refactoring Strategy</text>
                  <text fg={theme.text_muted} wrapMode="word">Applying sine-wave transformation for 3D logo rotation.</text>
                </box>
              </box>
            </scrollbox>
          </box>
        </Show>

        <Show when={props.tab === "diffs"}>
          <box flexDirection="column" flexGrow={1} minHeight={0} paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
            <Show when={props.diffItems.length > 0}>
              <box flexDirection="column" gap={1} flexShrink={0}>
                <box flexDirection="row" gap={1}>
                  <text fg={theme.text_primary}>
                    <span style={{ fg: theme.accent_success }}>+{diffTotals().additions}</span>{" "}
                    <span style={{ fg: theme.accent_error }}>-{diffTotals().deletions}</span>
                  </text>
                  <text fg={theme.text_secondary}>{diffTotals().files} files</text>
                  <text fg={theme.accent_success}>A:{groupTotals().added}</text>
                  <text fg={theme.accent_primary}>M:{groupTotals().modified}</text>
                  <text fg={theme.accent_error}>D:{groupTotals().deleted}</text>
                </box>
                <scrollbox
                  height={diffListHeight()}
                  viewportOptions={{
                    paddingRight: 1,
                  }}
                  verticalScrollbarOptions={{
                    trackOptions: {
                      backgroundColor: theme.surface_elev_1,
                      foregroundColor: edgeColor(),
                    },
                  }}
                >
                  <box flexDirection="column" gap={1}>
                    <For each={(["added", "modified", "deleted"] as const).filter((x) => groupedDiffs()[x].length > 0)}>
                      {(group) => (
                        <box flexDirection="column" gap={1}>
                          <text fg={theme.text_secondary}>
                            <span style={{ fg: accentForStatus(group) }}>{statusLabel(group)}</span> ({groupedDiffs()[group].length})
                          </text>
                          <For each={groupedDiffs()[group]}>
                            {(item) => (
                              <box
                                onMouseUp={() => props.onSelectDiff(item.file)}
                                border={["left"]}
                                borderColor={item.file === selectedDiff()?.file ? theme.focus_ring : theme.surface_elev_2}
                                paddingLeft={1}
                                backgroundColor={
                                  item.file === selectedDiff()?.file ? theme.surface_elev_2 : theme.surface_base
                                }
                              >
                                <text
                                  fg={item.file === selectedDiff()?.file ? theme.text_primary : theme.text_muted}
                                  wrapMode="none"
                                >
                                  <span style={{ fg: accentForStatus(status(item)) }}>{statusIcon(item.status)}</span> {item.file}{" "}
                                  <span style={{ fg: theme.accent_success }}>+{item.additions}</span>{" "}
                                  <span style={{ fg: theme.accent_error }}>-{item.deletions}</span>
                                </text>
                              </box>
                            )}
                          </For>
                        </box>
                      )}
                    </For>
                  </box>
                </scrollbox>
              </box>
            </Show>

            <Show when={props.diffItems.length === 0}>
              <text fg={theme.text_muted}>No file diffs yet.</text>
            </Show>

            <Show when={props.diffItems.length > 0}>
              <box flexGrow={1} minHeight={0}>
                <scrollbox
                  viewportOptions={{
                    paddingRight: 1,
                  }}
                  verticalScrollbarOptions={{
                    trackOptions: {
                      backgroundColor: theme.surface_elev_1,
                      foregroundColor: edgeColor(),
                    },
                  }}
                >
                  <Show when={selectedDiff()}>
                    {(item) => (
                      <box flexDirection="column" gap={1}>
                        <text fg={theme.text_secondary}>
                          <span style={{ fg: theme.text_primary }}>{item().file}</span>
                        </text>
                        <Show
                          when={selectedPatch()}
                          fallback={<text fg={theme.text_muted}>Diff preview unavailable for this file.</text>}
                        >
                          {(text) => (
                            <diff
                              diff={text()}
                              view={diffView()}
                              filetype={filetype(item().file)}
                              syntaxStyle={syntax()}
                              showLineNumbers={true}
                              width="100%"
                              wrapMode={props.diffWrapMode}
                              fg={theme.text}
                              addedBg={theme.diffAddedBg}
                              removedBg={theme.diffRemovedBg}
                              contextBg={theme.diffContextBg}
                              addedSignColor={theme.diffHighlightAdded}
                              removedSignColor={theme.diffHighlightRemoved}
                              lineNumberFg={theme.diffLineNumber}
                              lineNumberBg={theme.diffContextBg}
                              addedLineNumberBg={theme.diffAddedLineNumberBg}
                              removedLineNumberBg={theme.diffRemovedLineNumberBg}
                            />
                          )}
                        </Show>
                      </box>
                    )}
                  </Show>
                </scrollbox>
              </box>
            </Show>
          </box>
        </Show>
      </box>
    </box>
  )
}
