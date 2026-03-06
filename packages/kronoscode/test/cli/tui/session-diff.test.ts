import { describe, expect, test } from "bun:test"
import { groups, key, listKey, patch, sort, stats } from "../../../src/cli/cmd/tui/util/session-diff"

describe("session-diff", () => {
  test("builds a unified patch for modified files", () => {
    const diff = patch({
      file: "src/foo.ts",
      before: "const foo = 1\\n",
      after: "const foo = 2\\n",
      additions: 1,
      deletions: 1,
      status: "modified",
    } as any)

    expect(diff).toBeDefined()
    expect(diff).toContain("--- a/src/foo.ts")
    expect(diff).toContain("+++ b/src/foo.ts")
    expect(diff).toContain("@@")
  })

  test("uses /dev/null for file additions", () => {
    const diff = patch({
      file: "src/new.ts",
      before: "",
      after: "export const n = 1\\n",
      additions: 1,
      deletions: 0,
      status: "added",
    } as any)

    expect(diff).toContain("--- /dev/null")
    expect(diff).toContain("+++ b/src/new.ts")
  })

  test("uses /dev/null for file deletions", () => {
    const diff = patch({
      file: "src/old.ts",
      before: "export const n = 1\\n",
      after: "",
      additions: 0,
      deletions: 1,
      status: "deleted",
    } as any)

    expect(diff).toContain("--- a/src/old.ts")
    expect(diff).toContain("+++ /dev/null")
  })

  test("returns undefined for binary/empty diffs", () => {
    const empty = patch({
      file: "assets/logo.png",
      before: "",
      after: "",
      additions: 0,
      deletions: 0,
      status: "modified",
    } as any)
    const binary = patch({
      file: "assets/logo.png",
      before: "abc\0def",
      after: "abc\0xyz",
      additions: 0,
      deletions: 0,
      status: "modified",
    } as any)

    expect(empty).toBeUndefined()
    expect(binary).toBeUndefined()
  })

  test("groups and sorts by status and filename", () => {
    const input = [
      { file: "z.ts", before: "", after: "", additions: 1, deletions: 0, status: "added" },
      { file: "a.ts", before: "", after: "", additions: 2, deletions: 1, status: "modified" },
      { file: "b.ts", before: "", after: "", additions: 0, deletions: 5, status: "deleted" },
      { file: "a-new.ts", before: "", after: "", additions: 4, deletions: 0, status: "added" },
    ] as any

    const ordered = sort(input)
    expect(ordered.map((x) => x.file)).toEqual(["a-new.ts", "z.ts", "a.ts", "b.ts"])

    const grouped = groups(input)
    expect(grouped.added.map((x) => x.file)).toEqual(["a-new.ts", "z.ts"])
    expect(grouped.modified.map((x) => x.file)).toEqual(["a.ts"])
    expect(grouped.deleted.map((x) => x.file)).toEqual(["b.ts"])

    expect(stats(input)).toEqual({ files: 4, additions: 7, deletions: 6 })
  })

  test("generates stable keys for change tracking", () => {
    const a = key({
      file: "a/a.ts",
      before: "",
      after: "",
      additions: 3,
      deletions: 1,
      status: "modified",
    } as any)
    const b = listKey([
      {
        file: "a.ts",
        before: "",
        after: "",
        additions: 3,
        deletions: 1,
        status: "modified",
      },
      {
        file: "b.ts",
        before: "",
        after: "",
        additions: 2,
        deletions: 0,
        status: "added",
      },
    ] as any)

    expect(a).toBe("a.ts|modified|3|1")
    expect(b).toContain("a.ts|modified|3|1")
    expect(b).toContain("b.ts|added|2|0")
  })
})
