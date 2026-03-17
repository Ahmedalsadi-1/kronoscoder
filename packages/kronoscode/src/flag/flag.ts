function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

function enabledByDefault(key: string) {
  const value = process.env[key]
  if (value === undefined) return true
  return truthy(key)
}

export namespace Flag {
  export const KRONOSCODE_AUTO_SHARE = truthy("KRONOSCODE_AUTO_SHARE")
  export const KRONOSCODE_GIT_BASH_PATH = process.env["KRONOSCODE_GIT_BASH_PATH"]
  export const KRONOSCODE_CONFIG = process.env["KRONOSCODE_CONFIG"]
  export declare const KRONOSCODE_CONFIG_DIR: string | undefined
  export const KRONOSCODE_CONFIG_CONTENT = process.env["KRONOSCODE_CONFIG_CONTENT"]
  export const KRONOSCODE_DISABLE_AUTOUPDATE = truthy("KRONOSCODE_DISABLE_AUTOUPDATE")
  export const KRONOSCODE_DISABLE_PRUNE = truthy("KRONOSCODE_DISABLE_PRUNE")
  export const KRONOSCODE_DISABLE_TERMINAL_TITLE = truthy("KRONOSCODE_DISABLE_TERMINAL_TITLE")
  export const KRONOSCODE_PERMISSION = process.env["KRONOSCODE_PERMISSION"]
  export const KRONOSCODE_DISABLE_DEFAULT_PLUGINS = truthy("KRONOSCODE_DISABLE_DEFAULT_PLUGINS")
  export const KRONOSCODE_DISABLE_LSP_DOWNLOAD = truthy("KRONOSCODE_DISABLE_LSP_DOWNLOAD")
  export const KRONOSCODE_ENABLE_EXPERIMENTAL_MODELS = truthy("KRONOSCODE_ENABLE_EXPERIMENTAL_MODELS")
  export const KRONOSCODE_DISABLE_AUTOCOMPACT = truthy("KRONOSCODE_DISABLE_AUTOCOMPACT")
  export const KRONOSCODE_DISABLE_MODELS_FETCH = truthy("KRONOSCODE_DISABLE_MODELS_FETCH")
  export const KRONOSCODE_DISABLE_CLAUDE_CODE = truthy("KRONOSCODE_DISABLE_CLAUDE_CODE")
  export const KRONOSCODE_DISABLE_CLAUDE_CODE_PROMPT =
    KRONOSCODE_DISABLE_CLAUDE_CODE || truthy("KRONOSCODE_DISABLE_CLAUDE_CODE_PROMPT")
  export const KRONOSCODE_DISABLE_CLAUDE_CODE_SKILLS =
    KRONOSCODE_DISABLE_CLAUDE_CODE || truthy("KRONOSCODE_DISABLE_CLAUDE_CODE_SKILLS")
  export const KRONOSCODE_DISABLE_EXTERNAL_SKILLS =
    KRONOSCODE_DISABLE_CLAUDE_CODE_SKILLS || truthy("KRONOSCODE_DISABLE_EXTERNAL_SKILLS")
  export declare const KRONOSCODE_DISABLE_PROJECT_CONFIG: boolean
  export const KRONOSCODE_FAKE_VCS = process.env["KRONOSCODE_FAKE_VCS"]
  export declare const KRONOSCODE_CLIENT: string
  export const KRONOSCODE_SERVER_PASSWORD = process.env["KRONOSCODE_SERVER_PASSWORD"]
  export const KRONOSCODE_SERVER_USERNAME = process.env["KRONOSCODE_SERVER_USERNAME"]
  export const KRONOSCODE_ENABLE_QUESTION_TOOL = truthy("KRONOSCODE_ENABLE_QUESTION_TOOL")
  export const KRONOSCODE_ENABLE_AI_BROWSER = enabledByDefault("KRONOSCODE_ENABLE_AI_BROWSER")
  export const KRONOSCODE_AUTO_START_SCREENPIPE = enabledByDefault("KRONOSCODE_AUTO_START_SCREENPIPE")

  // Experimental
  export const KRONOSCODE_EXPERIMENTAL = truthy("KRONOSCODE_EXPERIMENTAL")
  export const KRONOSCODE_EXPERIMENTAL_FILEWATCHER = truthy("KRONOSCODE_EXPERIMENTAL_FILEWATCHER")
  export const KRONOSCODE_EXPERIMENTAL_DISABLE_FILEWATCHER = truthy("KRONOSCODE_EXPERIMENTAL_DISABLE_FILEWATCHER")
  export const KRONOSCODE_EXPERIMENTAL_ICON_DISCOVERY =
    KRONOSCODE_EXPERIMENTAL || truthy("KRONOSCODE_EXPERIMENTAL_ICON_DISCOVERY")

  const copy = process.env["KRONOSCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
  export const KRONOSCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT =
    copy === undefined ? process.platform === "win32" : truthy("KRONOSCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
  export const KRONOSCODE_ENABLE_EXA =
    truthy("KRONOSCODE_ENABLE_EXA") || KRONOSCODE_EXPERIMENTAL || truthy("KRONOSCODE_EXPERIMENTAL_EXA")
  export const KRONOSCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS = number(
    "KRONOSCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS",
  )
  export const KRONOSCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX = number("KRONOSCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX")
  export const KRONOSCODE_EXPERIMENTAL_OXFMT = KRONOSCODE_EXPERIMENTAL || truthy("KRONOSCODE_EXPERIMENTAL_OXFMT")
  export const KRONOSCODE_EXPERIMENTAL_LSP_TY = truthy("KRONOSCODE_EXPERIMENTAL_LSP_TY")
  export const KRONOSCODE_EXPERIMENTAL_LSP_TOOL = KRONOSCODE_EXPERIMENTAL || truthy("KRONOSCODE_EXPERIMENTAL_LSP_TOOL")
  export const KRONOSCODE_DISABLE_FILETIME_CHECK = truthy("KRONOSCODE_DISABLE_FILETIME_CHECK")
  export const KRONOSCODE_EXPERIMENTAL_PLAN_MODE =
    KRONOSCODE_EXPERIMENTAL || truthy("KRONOSCODE_EXPERIMENTAL_PLAN_MODE")
  export const KRONOSCODE_EXPERIMENTAL_MARKDOWN = truthy("KRONOSCODE_EXPERIMENTAL_MARKDOWN")
  export const KRONOSCODE_EXPERIMENTAL_MEDIA_PANEL =
    KRONOSCODE_EXPERIMENTAL || enabledByDefault("KRONOSCODE_EXPERIMENTAL_MEDIA_PANEL")
  export const KRONOSCODE_MODELS_URL = process.env["KRONOSCODE_MODELS_URL"]
  export const KRONOSCODE_MODELS_PATH = process.env["KRONOSCODE_MODELS_PATH"]

  function number(key: string) {
    const value = process.env[key]
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  }
}

// Dynamic getter for KRONOSCODE_DISABLE_PROJECT_CONFIG
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "KRONOSCODE_DISABLE_PROJECT_CONFIG", {
  get() {
    return truthy("KRONOSCODE_DISABLE_PROJECT_CONFIG")
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for KRONOSCODE_CONFIG_DIR
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "KRONOSCODE_CONFIG_DIR", {
  get() {
    return process.env["KRONOSCODE_CONFIG_DIR"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for KRONOSCODE_CLIENT
// This must be evaluated at access time, not module load time,
// because some commands override the client at runtime
Object.defineProperty(Flag, "KRONOSCODE_CLIENT", {
  get() {
    return process.env["KRONOSCODE_CLIENT"] ?? "cli"
  },
  enumerable: true,
  configurable: false,
})
