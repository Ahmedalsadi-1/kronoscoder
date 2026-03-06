import { createTwoFilesPatch } from "diff"
import type { Snapshot } from "@/snapshot"

function clean(file: string) {
  return file.replace(/^[ab]\//, "")
}

const STATUS_RANK = {
  added: 0,
  modified: 1,
  deleted: 2,
} as const

function status(item: Snapshot.FileDiff) {
  return item.status ?? "modified"
}

function name(item: Snapshot.FileDiff, side: "before" | "after") {
  const file = clean(item.file)
  if (side === "before" && item.status === "added") return "/dev/null"
  if (side === "after" && item.status === "deleted") return "/dev/null"
  return `${side === "before" ? "a" : "b"}/${file}`
}

function content(item: Snapshot.FileDiff, side: "before" | "after") {
  if (side === "before" && item.status === "added") return ""
  if (side === "after" && item.status === "deleted") return ""
  if (side === "before") return item.before
  return item.after
}

export function patch(item: Snapshot.FileDiff, context = 3) {
  const before = content(item, "before")
  const after = content(item, "after")
  if (!before && !after) return
  if (before.includes("\0") || after.includes("\0")) return

  const diff = createTwoFilesPatch(
    name(item, "before"),
    name(item, "after"),
    before,
    after,
    undefined,
    undefined,
    { context },
  )
  return diff.includes("\n@@") ? diff : undefined
}

export function sort(items: Snapshot.FileDiff[]) {
  return [...items].sort((a, b) => {
    const rank = STATUS_RANK[status(a)] - STATUS_RANK[status(b)]
    if (rank !== 0) return rank
    return clean(a.file).localeCompare(clean(b.file))
  })
}

export function groups(items: Snapshot.FileDiff[]) {
  return sort(items).reduce(
    (acc, item) => {
      acc[status(item)].push(item)
      return acc
    },
    {
      added: [] as Snapshot.FileDiff[],
      modified: [] as Snapshot.FileDiff[],
      deleted: [] as Snapshot.FileDiff[],
    },
  )
}

export function stats(items: Snapshot.FileDiff[]) {
  return items.reduce(
    (acc, item) => {
      acc.files += 1
      acc.additions += item.additions
      acc.deletions += item.deletions
      return acc
    },
    { files: 0, additions: 0, deletions: 0 },
  )
}

export function key(item: Snapshot.FileDiff) {
  return `${clean(item.file)}|${status(item)}|${item.additions}|${item.deletions}`
}

export function listKey(items: Snapshot.FileDiff[]) {
  return sort(items).map(key).join("||")
}
