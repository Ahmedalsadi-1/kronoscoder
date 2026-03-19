# Preview Tool

A visual preview tool for KronosCoder that renders UI components and 3D models directly in chat or a side panel.

## Installation

This tool is a **custom tool** for KronosCoder. Place it in your project's `.kronoscode/tools/` directory:

```
your-project/
└── .kronoscode/
    └── tools/
        └── preview.ts
```

Or in your home config directory:

```
~/.config/kronoscode/.kronoscode/tools/
└── preview.ts
```

KronosCoder will automatically discover and load custom tools on startup.

## Usage

### Inline Preview (Chat)

Basic usage shows file metadata and inline rendering:

```
/preview src/components/Button.tsx
```

### Side Panel Mode

For interactive previews with split view:

```
/preview src/components/Button.tsx --mode side-panel
```

### Full Options

```typescript
/preview <filePath> [options]

Options:
  --mode <mode>      Preview mode: inline, side-panel, fullscreen, iframe
  --theme <theme>    Theme: light, dark, auto
  --width <px>       Custom width for preview
  --height <px>      Custom height for preview
  --frame <n>        For 3D: animation frame to display
```

## Supported File Types

### UI Frameworks

| Framework | Extensions     | Features                                           |
| --------- | -------------- | -------------------------------------------------- |
| React     | `.tsx`, `.jsx` | Component analysis, prop detection, hook detection |
| Vue       | `.vue`         | Component name, reactive state, watchers           |
| Svelte    | `.svelte`      | Component analysis, reactive declarations          |
| Solid     | `.solid.tsx`   | Component analysis                                 |

### 3D Models

| Format | Extensions      | Features                 |
| ------ | --------------- | ------------------------ |
| glTF   | `.gltf`, `.glb` | Full support, animations |
| OBJ    | `.obj`          | Mesh loading             |
| FBX    | `.fbx`          | Animations               |
| STL    | `.stl`          | Mesh loading             |

### Other Formats

- **Images**: PNG, JPG, GIF, WebP, BMP
- **Vector**: SVG
- **Documents**: Markdown (.md, .mdx)
- **Web**: HTML, CSS

## Preview Modes

### `inline` (default)

Renders directly in chat with:

- File metadata and statistics
- Code snippets for text-based files
- Markdown images for image files
- Component analysis for UI frameworks

### `side-panel`

Opens a split panel view with:

- Interactive 3D viewer with orbit controls
- Full-resolution image display
- Component preview with hot reload
- Side-by-side code and preview

### `fullscreen`

Opens preview in fullscreen mode for detailed inspection.

### `iframe`

Embeds content in an iframe for isolated rendering.

## Examples

### Preview a React Component

```bash
/preview src/components/Modal.tsx
```

Output includes:

- Component name
- Props detected
- State hooks (useState)
- Effect hooks (useEffect)
- Imports

### Preview a 3D Model

```bash
/preview models/character.glb --mode side-panel --frame 0
```

Opens an interactive 3D viewer with:

- Orbit controls (click + drag)
- Zoom (scroll)
- Pan (right-click + drag)
- Animation frame selection

### Preview an Image

```bash
/preview assets/logo.png
```

Renders as markdown image directly in chat.

### Preview Markdown

```bash
/preview docs/api.md --mode side-panel
```

Side panel shows rendered markdown with styling.

## Component Analysis

For React/Vue/Svelte/Solid files, the tool analyzes:

- **Component Name**: Extracted from function/class declarations
- **Props**: Detected from function parameters
- **State**: useState (React), ref/reactive (Vue), $: (Svelte)
- **Effects**: useEffect (React), watch/watchEffect (Vue)
- **Imports**: External dependencies and imports

## Theme Support

The preview tool respects theme settings:

```bash
/preview Button.tsx --theme dark
```

Themes apply to:

- 3D viewer background
- Code syntax highlighting
- UI component previews

## Side Panel Integration

When using `--mode side-panel`, the tool outputs a structured JSON payload that KronosChamber parses to render the preview panel:

```json
{
  "type": "ui-component",
  "fileType": "react",
  "fileName": "Button.tsx",
  "componentName": "Button",
  "preview": {
    "url": "file://...",
    "componentInfo": {...},
    "theme": "auto"
  }
}
```

This enables the UI to:

- Parse the preview request
- Open a split panel
- Render the content appropriately
- Set up hot reload if enabled

## Troubleshooting

### Tool not loading

Make sure:

1. File is in `.kronoscode/tools/` directory
2. File exports a default tool
3. No TypeScript errors in the file

### 3D preview not working

Ensure your KronosChamber supports 3D rendering:

- WebGL must be available
- For GLB/GLTF, textures should be embedded or accessible

### Component analysis incomplete

Component detection is regex-based and may miss:

- Dynamically created components
- Components with unusual naming patterns
- Minified code

## Future Enhancements

- Live component preview with hot module replacement
- 3D model animation timeline controls
- Full Figma design import
- Diff preview for UI changes
- Accessibility audit integration
