# KronosChamber Browser Icons Implementation - Handoff for Gemini CLI

## Current Status Summary

- **Task**: Implement icon bar in ChatInput.tsx with 3 icons (Browser, Desktop, Options)
- **Progress**: ✅ Explored architecture, ✅ Located Desktop Browser implementation, ✅ Analyzed ChatInput structure
- **Current Location**: `/Users/albsheralsadi/kronosfinal/kronoscoder/kronosChamber/packages/ui/src/components/chat/ChatInput.tsx`
- **Next Step**: Add new icon bar component alongside existing footer controls

## Architecture Analysis

### Existing Desktop Browser Implementation

**Location**: `/Users/albsheralsadi/kronosfinal/kronoscoder/kronosChamber/packages/desktop/src-tauri/src/main.rs` (lines 1430-1532)

- Uses `WebviewBuilder` with tab management
- Already implemented with navigation, history management
- Can be opened via ensureBrowserSplitLayout()

### AI Browser Implementation

**Location**: `/Users/albsheralsadi/kronosfinal/kronoscoder/packages/kronoscode/src/browser/runtime.ts` (966 lines)

- Playwright-based browser with 27 tools for web automation
- Needs to be connected to kronoscode backend

### Current ChatInput Structure

**File**: `/Users/albsheralsadi/kronosfinal/kronoscoder/kronosChamber/packages/ui/src/components/chat/ChatInput.tsx`

- Footer controls rendered at lines 2689-2776
- Existing controls: attachmentsControls, desktopAgentModeControl, desktopResumeRuntimeControl
- Styling classes: footerIconButtonClass, iconSizeClass
- Mobile vs desktop layouts handled separately

## Required Implementation

### 1. Add New Icon Bar Component

**Location**: ChatInput.tsx alongside existing footer controls (around line 2767)

**Component Structure**:

```typescript
const browserIconControls = (
    <div className={cn('flex items-center gap-x-1.5', footerGapClass)}>
        {/* Browser icon - opens Desktop Browser (Live) */}
        {/* Desktop icon - activates desktop-control mode */}
        {/* Options icon - dropdown for background modes */}
    </div>
);
```

### 2. Implement Browser Icon

**Action**: Opens Desktop Browser (Live) - Built-in to KronosChamber
**Implementation**:

- Use `ensureBrowserSplitLayout()` function (already exists at line 261)
- Icon: `RiGlobalLine` or similar browser icon
- Tooltip: "Open Desktop Browser"

### 3. Implement Desktop Icon

**Action**: Activates desktop-control mode with automation MCPs
**Implementation**:

- Use existing `applyAgentMode('desktop-browser')` function
- Load prompts focused on: automation-mcp, computer-control mcp, everywhere app-mcp, apple-mcp
- Icon: `RiDesktopLine`
- Tooltip: "Desktop Control Mode"

### 4. Implement Options Icon

**Action**: Dropdown showing background modes (E2B Desktop, Playwright Browser)
**Implementation**:

- Use existing DropdownMenu pattern (see desktopAgentModeControl at line 2369)
- Options:
  - "E2B Desktop" - E2B sandbox environment
  - "Playwright Browser" - AI Browser via kronoscode
- Icon: `RiArrowDownSLine`
- Tooltip: "Background Modes"

### 5. Connect Playwright Browser

**Action**: Connect Playwright browser runtime to kronoscode backend
**Implementation**:

- Reference: `/Users/albsheralsadi/kronosfinal/kronoscoder/packages/kronoscode/src/browser/runtime.ts`
- Integrate with existing agent mode system
- Add to background mode options

## Code Context Details

### Existing Patterns to Follow

- **Styling**: Use `footerIconButtonClass`, `iconSizeClass`, `footerGapClass`
- **Icons**: Import from `@remixicon/react`
- **Dropdowns**: Follow `desktopAgentModeControl` pattern (lines 2369-2408)
- **Desktop Detection**: Use `isDesktopShell()` function
- **Agent Modes**: Use existing `applyAgentMode()`, `labelForDesktopAgentMode()`

### Key Functions Available

- `ensureBrowserSplitLayout()` - Opens browser layout
- `applyAgentMode(mode)` - Sets desktop agent mode
- `isDesktopShell()` - Checks if running in desktop app
- `labelForDesktopAgentMode(mode)` - Gets mode display name

### Import Requirements

Add to existing imports:

```typescript
import { RiGlobalLine, RiDesktopLine, RiArrowDownSLine } from "@remixicon/react"
```

## Integration Points

### Where to Add in ChatInput

**Location**: Line 2767 in the desktop layout (non-mobile)

```typescript
<div className={cn('flex min-w-0 flex-1 flex-wrap items-center justify-end gap-y-1.5', footerGapClass, 'md:gap-x-3')}>
    <ModelControls className={cn('min-w-[180px] flex-[1_1_220px] justify-end')} />
    {browserIconControls}  {/* ADD THIS NEW COMPONENT */}
    {desktopPrimaryAgentControl}
    {desktopAgentModeControl}
    {desktopResumeRuntimeControl}
    <BrowserVoiceButton />
    {actionButtons}
</div>
```

## Testing Requirements

1. **Browser icon**: Opens Desktop Browser WebView
2. **Desktop icon**: Activates automation MCP mode
3. **Options icon**: Shows dropdown with E2B and Playwright options
4. **Mobile layout**: Ensure icons work on mobile (lines 2701-2731)
5. **Desktop integration**: Verify only shows in desktop app

## Error Handling

- Only show desktop controls when `isDesktopShell()` returns true
- Handle agent mode loading states
- Graceful fallback if browser integration fails

## Dependencies

- Existing: `@remixicon/react`, React, Zustand stores
- New: May need to import additional icons from RemixIcon
- Backend: Integration with kronoscode browser runtime

---

## PROMPT FOR GEMINI CLI

```bash
# Continue implementing the browser icons feature in KronosChamber
# WORKING DIRECTORY: /Users/albsheralsadi/kronosfinal/kronoscoder/kronosChamber/packages/ui/src/components/chat

# TASK 1: Complete the icon bar implementation
# - Add missing icon imports to ChatInput.tsx
# - Create browserIconControls component with 3 icons
# - Implement Browser icon (opens Desktop Browser)
# - Implement Desktop icon (activates automation MCPs)
# - Implement Options icon (dropdown with E2B/Playwright)

# TASK 2: Connect Playwright browser backend
# - Reference packages/kronoscode/src/browser/runtime.ts
# - Integrate with existing agent mode system
# - Add Playwright option to background modes dropdown

# TASK 3: Testing and verification
# - Test all icons in desktop environment
# - Verify mobile layout compatibility
# - Ensure existing functionality remains intact

# CONSTRAINTS:
# - Follow existing code patterns and styling
# - Use existing functions: ensureBrowserSplitLayout(), applyAgentMode()
# - Only show desktop controls in desktop app (isDesktopShell())
# - Maintain accessibility with proper aria-labels
# - Handle loading states gracefully

# START BY: Reading the current ChatInput.tsx file and implementing the browserIconControls component
```

## Files to Work On

1. `/Users/albsheralsadi/kronosfinal/kronoscoder/kronosChamber/packages/ui/src/components/chat/ChatInput.tsx` - Main implementation
2. `/Users/albsheralsadi/kronosfinal/kronoscoder/packages/kronoscode/src/browser/runtime.ts` - Playwright integration reference
3. `/Users/albsheralsadi/kronosfinal/kronoscoder/kronosChamber/packages/desktop/src-tauri/src/main.rs` - Desktop Browser reference

## Success Criteria

- ✅ Browser icon opens Desktop Browser (Live)
- ✅ Desktop icon activates automation MCP mode
- ✅ Options icon shows E2B/Playwright background modes
- ✅ All icons follow existing UI patterns
- ✅ Mobile compatibility maintained
- ✅ Integration with kronoscode backend completed
