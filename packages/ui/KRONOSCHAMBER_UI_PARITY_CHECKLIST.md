# KronosChamber UI Parity Checklist

Use this checklist after desktop/runtime contract changes to ensure UI parity remains intact.

## Core Flow

- [ ] Launch desktop with `bun --cwd packages/desktop tauri:dev`.
- [ ] Confirm app opens into KronosChamber shell without blank/fallback screen.
- [ ] Confirm chat input, send, and response render work in the main session view.

## Desktop Integration

- [ ] Trigger menu actions (new session, settings, check for updates) and confirm UI receives `kronoschamber:*` events.
- [ ] Confirm desktop browser state updates are reflected in UI controls/panels.
- [ ] Confirm update progress events render in UI when update checks run.
- [ ] Confirm app restart event (`kronoschamber:server-restarted`) is handled without reload loops.

## Visual Parity

- [ ] Validate top-level navigation and sidebar layout match KronosChamber baseline.
- [ ] Validate settings surfaces (theme/fonts/desktop section) match KronosChamber design language.
- [ ] Validate session sidebars, file views, and tool outputs preserve expected typography, spacing, and colors.

## Media and Live Preview

- [ ] Run `/media` and `/live` from TUI and verify right panel behavior.
- [ ] Confirm screenshot/media artifacts from browser and desktop-control tools are discoverable and viewable.

## Compatibility Window (One Release)

- [ ] Verify canonical events/channels are present (`kronoschamber:*`, `kronoschamber://*`).
- [ ] Verify legacy aliases still function for existing local environments.
- [ ] Confirm no user-facing label shows `OpenChamber` or `OpenCode`.
