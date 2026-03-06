# kronosChamber: Computer Control Implementation Plan

**Date:** 2026-02-28  
**Goal:** Beat OpenClaw with superior desktop control + visual onboarding

---

## Current State

### Already Implemented

- ✅ MCP support (useMcpStore.ts)
- ✅ e2b connector (agentModeApi.ts)
- ✅ Browser automation via openbrowser
- ✅ Multi-page browser sessions
- ✅ Settings system in kronosChamber

### Gaps

- ❌ No native desktop control (only browser)
- ❌ No visual onboarding wizard
- ❌ No QR code for mobile pairing
- ❌ No VM spawning
- ❌ Basic tab management

---

## 1. Desktop Control via MCP Servers

### Recommended MCP Servers to Integrate

| MCP Server                                                                                                  | Stars | Language   | Key Features                                |
| ----------------------------------------------------------------------------------------------------------- | ----- | ---------- | ------------------------------------------- |
| [computer-use-mcp](https://github.com/domdomegg/computer-use-mcp)                                           | 137   | TypeScript | Mouse, keyboard, screenshot, cross-platform |
| [computer-control-mcp](https://github.com/AB498/computer-control-mcp)                                       | 116   | Python     | OCR, PyAutoGUI, element detection           |
| [mcp-server-client-computer-use-ai-sdk](https://github.com/mediar-ai/mcp-server-client-computer-use-ai-sdk) | 192   | Rust       | Native macOS, screenpipe-based              |
| [mcp-desktop-automation](https://github.com/tanob/mcp-desktop-automation)                                   | 25    | JS         | RobotJS, screenshot                         |

### Implementation Approach

```typescript
// Integration path: packages/opencode/src/mcp/

// Add to MCP registry:
const DESKTOP_CONTROL_MCP = {
  "computer-use-mcp": {
    install: "npx -y @domdomegg/computer-use-mcp",
    config: {
      // Default config
    },
  },
  "computer-control-mcp": {
    install: "uvx computer-control-mcp",
    config: {},
  },
}
```

### Tools to Expose

- `mouse_move(x, y)` - Move cursor
- `mouse_click(button, x, y)` - Click
- `mouse_drag(start, end)` - Drag
- `keyboard_type(text)` - Type text
- `keyboard_hotkey(keys)` - Shortcuts
- `screenshot()` - Capture screen
- `window_list()` - List windows
- `window_focus(name)` - Focus window

---

## 2. e2b Desktop Integration

### Current Status

Already partially integrated in `agentModeApi.ts`:

```typescript
connectors?: {
  e2b?: {
    available?: boolean;
    provider?: 'api' | 'command' | 'none';
    apiConfigured?: boolean;
    command?: string | null;
    commandAvailable?: boolean;
    endpoint?: string | null;
  };
}
```

### Enhancement: VM Spawning

Add ability to spin up ephemeral VMs:

```typescript
// New API endpoint
POST /api/agent-mode/vm/spawn
{
  image: 'ubuntu-22.04' | 'windows-11' | 'fedora-40',
  timeout: 3600, // seconds
  resources: { cpu: 2, memory: 4GB }
}

// Response
{
  vmId: string,
  connectionUrl: string,
  credentials: { user, password }
}
```

### e2b SDK Integration

```bash
# Install e2b SDK
npm install @e2b/code-interpreter
```

---

## 3. Visual Onboarding Wizard (OpenClaw-style)

### Reference: OpenClaw Implementation

**CLI Command:** `openclaw onboard`  
**QR Code:** `openclaw qr` - Generates pairing QR for mobile

### kronosChamber Implementation

#### Flow

1. **Welcome Screen** → Choose: Local or Remote
2. **Provider Setup** → Select AI provider (Anthropic, OpenAI, etc.)
3. **Channel Setup** → WhatsApp, Telegram, Discord, etc.
4. **Skills Selection** → Choose default skills
5. **Mobile Pairing** → QR code for phone control
6. **Complete** → Summary + start using

#### Components to Create

```
packages/ui/src/components/onboarding/
├── OnboardingWizard.tsx    # Main wizard container
├── WelcomeStep.tsx        # Local/Remote choice
├── ProviderStep.tsx       # AI provider selection
├── ChannelStep.tsx        # Messaging channels
├── SkillsStep.tsx         # Skill selection
├── MobilePairingStep.tsx  # QR code display
└── CompleteStep.tsx       # Success + next steps
```

#### QR Code Generation

```typescript
// Use qrcode library
import QRCode from "qrcode"

const generatePairingQR = async (config: GatewayConfig) => {
  const payload = {
    gatewayUrl: config.url,
    token: config.token,
    setupCode: config.setupCode,
  }

  return QRCode.toDataURL(JSON.stringify(payload))
}
```

---

## 4. Browser Tab Window Management

### Current: Multi-page already exists

- `desktopBrowserNewPage()` - Create new page
- `desktopBrowserClosePage()` - Close page
- `desktopBrowserSelectPage()` - Switch pages

### Enhancements Needed

| Feature         | Priority | Description        |
| --------------- | -------- | ------------------ |
| Tab Drag & Drop | Medium   | Reorder tabs       |
| Tab Groups      | Medium   | Group related tabs |
| Tab Search      | Low      | Quick tab switcher |
| Tab Pinning     | Low      | Pin important tabs |
| Split View      | High     | Side-by-side tabs  |

### Implementation

```typescript
// Add to BrowserView.tsx
interface TabGroup {
  id: string
  name: string
  tabs: string[]
}

interface SplitView {
  id: string
  orientation: "horizontal" | "vertical"
  tabs: string[]
}
```

---

## 5. Skills System (OpenClaw-style)

### Reference Skills to Add

1. **qr-code-generator** - Generate QR codes
2. **browser-automation** - Common browser tasks
3. **file-management** - File operations
4. **system-control** - OS commands

### Skills Discovery

```bash
# OpenClaw uses npx playbooks
npx playbooks add skill openclaw/skills

# kronosChamber can integrate:
npx skills find [query]
```

---

## Implementation Priority

### Phase 1: Desktop Control (Week 1-2)

1. Add computer-use-mcp to MCP registry
2. Create desktop control tools
3. Add screenshot display to UI

### Phase 2: Visual Onboarding (Week 2-3)

1. Create onboarding wizard components
2. Add QR code generation
3. Integrate with settings

### Phase 3: VM Integration (Week 3-4)

1. Add e2b VM spawning API
2. Create VM management UI
3. Add timeout + resource controls

### Phase 4: Browser Improvements (Week 4-5)

1. Split view tabs
2. Tab groups
3. Tab search

---

## Technical Notes

### Security Considerations

- Sandbox MCP server execution
- Permission prompts for desktop control
- Audit logging for all automation
- Timeout limits for VM instances

### Performance

- Lazy load MCP servers
- Cache screenshots
- Debounce automation actions
