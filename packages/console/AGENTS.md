# @kronoscode-ai/console

Console app with nested packages: app, core, function, mail, resource.

## Overview

Nested workspace packages for console-related functionality.

## Structure

```
packages/console/
├── app/      # Main console application
├── core/     # Core functionality
├── function/ # Console functions
├── mail/     # Email functionality
└── resource/ # Resource management
```

## Development

Each sub-package has its own package.json. Workspaces configured in root package.json.

## Notes

- Run from package dir: `bun run --cwd packages/console/app dev`
- Follows root style guide: single word names, avoid try/catch, avoid any
