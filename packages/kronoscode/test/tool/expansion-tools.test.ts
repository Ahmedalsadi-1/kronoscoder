import { describe, expect, test } from "bun:test"
import { ToolRegistry } from "../../src/tool/registry"
import { Instance } from "../../src/project/instance"

describe("tool expansion surface", () => {
  test("includes E2B desktop automation tools", async () => {
    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        const ids = await ToolRegistry.ids()
        expect(ids).toContain("e2b_desktop_screenshot")
        expect(ids).toContain("e2b_desktop_click")
        expect(ids).toContain("e2b_desktop_type")
        expect(ids).toContain("e2b_desktop_hotkey")
        expect(ids).toContain("e2b_desktop_run_macro")
      },
    })
  })

  test("includes bridge and voice orchestration tools", async () => {
    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        const ids = await ToolRegistry.ids()
        expect(ids).toContain("anything_browser_action")
        expect(ids).toContain("anything_double_click_handoff")
        expect(ids).toContain("voice_box_open")
        expect(ids).toContain("voice_box_listen")
        expect(ids).toContain("voice_box_inject_prompt")
      },
    })
  })

  test("includes granular Pluely and Jaaz tools", async () => {
    await Instance.provide({
      directory: process.cwd(),
      fn: async () => {
        const ids = await ToolRegistry.ids()
        expect(ids).toContain("pluely_voice_start")
        expect(ids).toContain("pluely_transcript_get")
        expect(ids).toContain("jaaz_generate")
        expect(ids).toContain("jaaz_generate_batch")
        expect(ids).toContain("jaaz_export")
      },
    })
  })
})
