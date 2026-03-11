# Guardrail Guidelines

## Overview

Use this file for repo-wide safety constraints around scope, secrets, and git operations.

## Security

- Never commit `.env` files, API keys, or other secrets.
- Keep logs, screenshots, and generated reports free of sensitive data.

## Scope Control

- Avoid drive-by refactors; keep diffs surgical.
- Run the relevant lint and typecheck commands before a commit.
- Create new documentation only when the task explicitly asks for it.
- Create new files only when the task requires them.

## Git and Tooling Boundaries

- Never update git config from within a task.
- Never run destructive git commands such as `push --force` or `reset --hard` unless explicitly requested.
- Never skip hooks with `--no-verify` unless explicitly requested.
- Never commit unless explicitly asked.
