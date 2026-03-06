#!/usr/bin/env bash
set -euo pipefail

# KronosCode Universal Installer
# Links the `kronoscode` command globally for local development use.

REPO_ROOT="$(pwd)"

echo "[install] Installing kronoscode command..."

if [ ! -f "${REPO_ROOT}/package.json" ]; then
  echo "[install] Error: run this script from the repository root."
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "[install] Error: bun is required but not found in PATH."
  exit 1
fi

echo "[install] Installing dependencies..."
bun install --ignore-scripts

if [ "${KRONOSCODE_INSTALL_WITH_BUN_LINK:-0}" = "1" ]; then
  echo "[install] Linking kronoscode package with bun link..."
  cd "${REPO_ROOT}/packages/kronoscode"
  bun link
  cd "${REPO_ROOT}"
else
  echo "[install] Skipping bun link (set KRONOSCODE_INSTALL_WITH_BUN_LINK=1 to enable)."
fi

BIN_SOURCE="${REPO_ROOT}/packages/kronoscode/bin/kronoscode"
LOCAL_BIN_DIR="${HOME}/.local/bin"
mkdir -p "${LOCAL_BIN_DIR}"
ln -sf "${BIN_SOURCE}" "${LOCAL_BIN_DIR}/kronoscode"
if [ -d "${HOME}/.bun/bin" ]; then
  ln -sf "${BIN_SOURCE}" "${HOME}/.bun/bin/kronoscode"
  echo "[install] Linked ${HOME}/.bun/bin/kronoscode"
fi

if [ -w "/usr/local/bin" ]; then
  ln -sf "${BIN_SOURCE}" /usr/local/bin/kronoscode
  echo "[install] Linked /usr/local/bin/kronoscode"
fi

if ! command -v kronoscode >/dev/null 2>&1; then
  echo "[install] Warning: kronoscode is linked, but not yet in current shell PATH."
  echo "[install] Add this to your shell profile if needed:"
  echo "export PATH=\"${LOCAL_BIN_DIR}:\$PATH\""
fi

if command -v kronoscode >/dev/null 2>&1; then
  echo "[install] Binary diagnostics:"
  kronoscode --version || true
fi

if [ "${KRONOSCODE_INSTALL_APPLY_CONFIG:-1}" = "1" ]; then
  echo "[install] Applying Kronos defaults (skills + MCP config)..."
  if ! node scripts/apply-kronos-config.mjs; then
    echo "[install] Warning: apply-kronos-config failed; continuing install."
  fi
else
  echo "[install] Skipping config apply (set KRONOSCODE_INSTALL_APPLY_CONFIG=1 to enable)."
fi

echo "[install] Done."
echo "Usage:"
echo "  kronoscode"
echo "  kronoscode web"
echo "  kronoscode desktop"
echo "  kronoscode debug restart-all --with-browseros --with-desktop"
echo
echo "Post-install checks:"
echo "  node scripts/apply-kronos-config.mjs --json"
echo "  kronoscode debug skill"
echo "  kronoscode agent list"
