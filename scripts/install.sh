#!/usr/bin/env bash
set -euo pipefail

# KronosCode bootstrap installer (macOS/Linux)
# Supports: curl -fsSL <url>/scripts/install.sh | bash

REPO_URL="${KRONOSCODE_REPO_URL:-https://github.com/anomalyco/kronoscode.git}"
BRANCH="${KRONOSCODE_BRANCH:-dev}"
INSTALL_DIR="${KRONOSCODE_INSTALL_DIR:-$HOME/.kronoscode/src/kronoscoder}"

echo "[bootstrap] Installing KronosCode from ${REPO_URL} (${BRANCH})"

for cmd in git bun node; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "[bootstrap] Error: required command '${cmd}' is not installed."
    exit 1
  fi
done

mkdir -p "$(dirname "${INSTALL_DIR}")"
if [ -d "${INSTALL_DIR}/.git" ]; then
  echo "[bootstrap] Updating existing checkout at ${INSTALL_DIR}"
  git -C "${INSTALL_DIR}" fetch --depth 1 origin "${BRANCH}"
  git -C "${INSTALL_DIR}" checkout "${BRANCH}"
  git -C "${INSTALL_DIR}" pull --ff-only origin "${BRANCH}"
else
  echo "[bootstrap] Cloning repository to ${INSTALL_DIR}"
  git clone --depth 1 --branch "${BRANCH}" "${REPO_URL}" "${INSTALL_DIR}"
fi

cd "${INSTALL_DIR}"
bash scripts/universal-install.sh

echo
echo "[bootstrap] Installed."
echo "[bootstrap] Start everything:"
echo "  node scripts/restart-all.mjs --with-browseros --with-desktop --json"
