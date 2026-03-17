import z from "zod"
import { Tool } from "./tool"

type VoiceBusState = {
  opened: boolean
  listening: boolean
  interrupted: boolean
  injectedPrompts: string[]
  updatedAt: number
}

const sessionVoiceBus = new Map<string, VoiceBusState>()

const readState = (sessionID: string): VoiceBusState =>
  sessionVoiceBus.get(sessionID) || {
    opened: false,
    listening: false,
    interrupted: false,
    injectedPrompts: [],
    updatedAt: Date.now(),
  }

const writeState = (sessionID: string, state: VoiceBusState) => {
  sessionVoiceBus.set(sessionID, { ...state, updatedAt: Date.now() })
  return sessionVoiceBus.get(sessionID)!
}

const metadata = {
  connector: "voice_bus",
  risk_level: "medium",
  interactive: true,
  fallback: ["useBrowserVoice", "useServerTTS"],
}

export const VoiceBoxOpenTool = Tool.define("voice_box_open", {
  description: "Open the voice box orchestration bus for the active session.",
  parameters: z.object({}),
  async execute(_args, ctx) {
    const state = readState(ctx.sessionID)
    const next = writeState(ctx.sessionID, {
      ...state,
      opened: true,
      interrupted: false,
    })
    return {
      title: "Voice Box Open",
      output: "Voice box opened for current session.",
      metadata: { ...metadata, state: next },
    }
  },
})

export const VoiceBoxListenTool = Tool.define("voice_box_listen", {
  description: "Set voice box into active listening mode for the current session.",
  parameters: z.object({}),
  async execute(_args, ctx) {
    const state = readState(ctx.sessionID)
    const next = writeState(ctx.sessionID, {
      ...state,
      opened: true,
      listening: true,
      interrupted: false,
    })
    return {
      title: "Voice Box Listen",
      output: "Voice box listening enabled.",
      metadata: { ...metadata, state: next },
    }
  },
})

export const VoiceBoxInterruptTool = Tool.define("voice_box_interrupt", {
  description: "Interrupt the active voice flow for the current session.",
  parameters: z.object({}),
  async execute(_args, ctx) {
    const state = readState(ctx.sessionID)
    const next = writeState(ctx.sessionID, {
      ...state,
      listening: false,
      interrupted: true,
    })
    return {
      title: "Voice Box Interrupt",
      output: "Voice flow interrupted.",
      metadata: { ...metadata, state: next },
    }
  },
})

export const VoiceBoxInjectPromptTool = Tool.define("voice_box_inject_prompt", {
  description: "Inject a spoken prompt into session voice bus so desktop tasks can react.",
  parameters: z.object({
    prompt: z.string().min(1),
  }),
  async execute(args, ctx) {
    const state = readState(ctx.sessionID)
    const next = writeState(ctx.sessionID, {
      ...state,
      opened: true,
      interrupted: false,
      injectedPrompts: [...state.injectedPrompts, args.prompt].slice(-20),
    })
    return {
      title: "Voice Box Inject Prompt",
      output: `Injected prompt into voice bus: ${args.prompt}`,
      metadata: { ...metadata, state: next },
    }
  },
})
