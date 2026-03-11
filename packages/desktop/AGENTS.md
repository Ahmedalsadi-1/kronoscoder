# @kronoscode-ai/desktop

Desktop application using Tauri. Targets macOS, Windows, Linux.

## Overview

Native desktop wrapper for KronosCode. Uses Tauri with web view.

## Structure

```
packages/desktop/
├── src-tauri/           # Rust source (Tauri)
│   ├── src/             # Rust entry points
│   ├── capabilities/    # Permission config
│   ├── tauri.conf.json  # Tauri config
│   └── resources/       # Bundled assets
├── public/              # Static assets
└── scripts/             # Build helper scripts
```

## Scripts

```bash
bun run desktop:dev    # Run in dev mode
bun run desktop:build  # Build release
```

## Tauri Configuration

- **Config**: `src-tauri/tauri.conf.json`
- **Permissions**: `src-tauri/capabilities/`
- **Code Signing**: Configured for macOS/Windows

## Dependencies

- `@tauri-apps/api` - Tauri JS API
- `tauri` - Desktop framework

## Notes

- Uses web view from kronosChamber or packages/ui
- Native capabilities via Tauri plugins
- Build outputs: .dmg (macOS), .exe (Windows), .AppImage/.deb (Linux)
