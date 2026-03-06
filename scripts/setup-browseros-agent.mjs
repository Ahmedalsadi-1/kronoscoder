#!/usr/bin/env node

import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { spawn, spawnSync } from 'child_process';

const BROWSEROS_REPO_URL = 'https://github.com/Ahmedalsadi-1/BrowserOS.git';
const BROWSEROS_AGENT_REPO_URL = 'https://github.com/browseros-ai/BrowserOS-agent.git';

const HOME = os.homedir();
const BASE_DIR = path.join(HOME, '.kronoscode', 'agents');
const BROWSEROS_REPO_DIR = path.join(BASE_DIR, 'browseros');
const AGENT_REPO_DIR = path.join(BASE_DIR, 'browseros-agent');
const BIN_DIR = path.join(BASE_DIR, 'bin');
const LOG_DIR = path.join(BASE_DIR, 'logs');
const STATE_DIR = path.join(BASE_DIR, 'state');

const LAUNCHER_PATH = path.join(BIN_DIR, 'browseros-agent-server');
const PID_PATH = path.join(STATE_DIR, 'browseros-agent.pid');
const LOG_PATH = path.join(LOG_DIR, 'browseros-agent.log');
const CDP_PID_PATH = path.join(STATE_DIR, 'browseros-cdp.pid');
const CDP_LOG_PATH = path.join(LOG_DIR, 'browseros-cdp.log');
const ENV_FILE_PATH = path.join(AGENT_REPO_DIR, 'apps', 'server', '.env.development');
const ENV_EXAMPLE_PATH = path.join(AGENT_REPO_DIR, 'apps', 'server', '.env.example');

const DEFAULT_SERVER_PORT = 9239;
const DEFAULT_CDP_PORT = 9222;
const DEFAULT_EXTENSION_PORT = 9240;
const CDP_DISCOVERY_PORTS = [9354, 9222, 9223, 9333];

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 65535) {
    return parsed;
  }
  return fallback;
};

const resolveServerPort = () =>
  toInt(process.env.BROWSEROS_SERVER_PORT || process.env.KRONOSCHAMBER_BROWSEROS_SERVER_PORT, DEFAULT_SERVER_PORT);

const resolveCdpPort = () =>
  toInt(process.env.BROWSEROS_CDP_PORT || process.env.KRONOSCHAMBER_BROWSEROS_CDP_PORT, DEFAULT_CDP_PORT);

const resolveExtensionPort = () =>
  toInt(process.env.BROWSEROS_EXTENSION_PORT || process.env.KRONOSCHAMBER_BROWSEROS_EXTENSION_PORT, DEFAULT_EXTENSION_PORT);

const resolveAutoStartCdp = () => {
  const raw =
    process.env.BROWSEROS_AUTO_START_CDP ??
    process.env.KRONOSCHAMBER_BROWSEROS_AUTO_START_CDP ??
    '1';
  const value = String(raw).trim().toLowerCase();
  return !(value === '0' || value === 'false' || value === 'no' || value === 'off');
};

const ensureDirectory = (targetPath) => {
  fs.mkdirSync(targetPath, { recursive: true });
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    stdio: 'pipe',
    encoding: 'utf8',
    ...options,
  });
  if (result.status === 0) {
    return result;
  }
  const stderr = String(result.stderr || '').trim();
  const stdout = String(result.stdout || '').trim();
  const detail = stderr || stdout || `exit code ${result.status ?? 'unknown'}`;
  throw new Error(`${command} ${args.join(' ')} failed: ${detail}`);
};

const resolveBun = () => {
  const fromEnv = String(process.env.BUN_BINARY || '').trim();
  if (fromEnv) {
    return fromEnv;
  }
  if (path.basename(process.execPath).toLowerCase().includes('bun')) {
    return process.execPath;
  }
  const found = spawnSync('which', ['bun'], { stdio: 'pipe', encoding: 'utf8' });
  if (found.status === 0) {
    const candidate = String(found.stdout || '').trim().split(/\s+/)[0];
    if (candidate) {
      return candidate;
    }
  }
  return 'bun';
};

const isProcessAlive = (pid) => {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const httpCheck = (url, timeoutMs = 2500) =>
  new Promise((resolve) => {
    const request = http.get(url, { timeout: timeoutMs }, (response) => {
      response.resume();
      resolve(response.statusCode && response.statusCode >= 200 && response.statusCode < 500);
    });
    request.on('timeout', () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => resolve(false));
  });

const waitForHealth = async (url, timeoutMs = 30000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await httpCheck(url);
    if (ok) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
};

const waitForCdp = (port, timeoutMs = 30000) =>
  waitForHealth(`http://127.0.0.1:${port}/json/version`, timeoutMs);

const hasExplicitCdpPort = () =>
  Boolean(
    String(process.env.BROWSEROS_CDP_PORT || '').trim() ||
      String(process.env.KRONOSCHAMBER_BROWSEROS_CDP_PORT || '').trim(),
  );

const parseEnvLines = (content) => {
  const map = new Map();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1);
    if (key) {
      map.set(key, value);
    }
  }
  return map;
};

const stringifyEnvMap = (map) =>
  [
    '# Managed by scripts/setup-browseros-agent.mjs',
    `BROWSEROS_CDP_PORT=${map.get('BROWSEROS_CDP_PORT') ?? String(DEFAULT_CDP_PORT)}`,
    `BROWSEROS_SERVER_PORT=${map.get('BROWSEROS_SERVER_PORT') ?? String(DEFAULT_SERVER_PORT)}`,
    `BROWSEROS_EXTENSION_PORT=${map.get('BROWSEROS_EXTENSION_PORT') ?? String(DEFAULT_EXTENSION_PORT)}`,
    `NODE_ENV=${map.get('NODE_ENV') ?? 'development'}`,
    `LOG_LEVEL=${map.get('LOG_LEVEL') ?? 'info'}`,
    `BROWSEROS_MCP_URL=${map.get('BROWSEROS_MCP_URL') ?? `http://127.0.0.1:${map.get('BROWSEROS_SERVER_PORT') ?? String(DEFAULT_SERVER_PORT)}/mcp`}`,
    '',
    '# Optional BrowserOS cloud configuration',
    `BROWSEROS_CONFIG_URL=${map.get('BROWSEROS_CONFIG_URL') ?? 'https://llm.browseros.com/api/browseros-server/config'}`,
    `BROWSEROS_VERSION=${map.get('BROWSEROS_VERSION') ?? ''}`,
    `BROWSEROS_INSTALL_ID=${map.get('BROWSEROS_INSTALL_ID') ?? ''}`,
    `BROWSEROS_CLIENT_ID=${map.get('BROWSEROS_CLIENT_ID') ?? ''}`,
    '',
  ].join('\n');

const readManagedEnv = () => {
  const map = new Map();
  if (fs.existsSync(ENV_EXAMPLE_PATH)) {
    const content = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8');
    for (const [key, value] of parseEnvLines(content).entries()) {
      map.set(key, value);
    }
  }
  if (fs.existsSync(ENV_FILE_PATH)) {
    const content = fs.readFileSync(ENV_FILE_PATH, 'utf8');
    for (const [key, value] of parseEnvLines(content).entries()) {
      map.set(key, value);
    }
  }

  map.set('BROWSEROS_CDP_PORT', String(resolveCdpPort()));
  map.set('BROWSEROS_SERVER_PORT', String(resolveServerPort()));
  map.set('BROWSEROS_EXTENSION_PORT', String(resolveExtensionPort()));
  map.set('BROWSEROS_MCP_URL', `http://127.0.0.1:${map.get('BROWSEROS_SERVER_PORT')}/mcp`);

  return map;
};

const cloneOrUpdateRepository = (repoUrl, repoDir) => {
  const gitDir = path.join(repoDir, '.git');
  if (fs.existsSync(repoDir) && !fs.existsSync(gitDir)) {
    const entries = fs.readdirSync(repoDir);
    if (entries.length === 0) {
      fs.rmSync(repoDir, { recursive: true, force: true });
    } else {
      const backupDir = `${repoDir}.backup-${Date.now()}`;
      fs.renameSync(repoDir, backupDir);
    }
  }

  if (!fs.existsSync(gitDir)) {
    run('git', ['clone', '--depth', '1', repoUrl, repoDir]);
    return;
  }

  run('git', ['-C', repoDir, 'fetch', '--all', '--prune']);
  const branchResult = run('git', ['-C', repoDir, 'branch', '--show-current']);
  const branch = String(branchResult.stdout || '').trim() || 'main';
  run('git', ['-C', repoDir, 'pull', '--ff-only', 'origin', branch]);
};

const ensureLauncher = () => {
  ensureDirectory(BIN_DIR);
  const launcher = `#!/usr/bin/env bash
set -euo pipefail

ROOT="${AGENT_REPO_DIR}"
ENV_FILE="$ROOT/apps/server/.env.development"
BUN_BIN="${resolveBun()}"

if [ ! -f "$ROOT/package.json" ]; then
  echo "BrowserOS-agent repository missing at $ROOT" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "BrowserOS agent env file missing at $ENV_FILE" >&2
  exit 1
fi

: "\${BROWSEROS_CDP_PORT:=${resolveCdpPort()}}"
: "\${BROWSEROS_SERVER_PORT:=${resolveServerPort()}}"
: "\${BROWSEROS_EXTENSION_PORT:=${resolveExtensionPort()}}"

cd "$ROOT"
exec "$BUN_BIN" --env-file="$ENV_FILE" apps/server/src/index.ts "$@"
`;

  fs.writeFileSync(LAUNCHER_PATH, launcher, 'utf8');
  fs.chmodSync(LAUNCHER_PATH, 0o755);
};

const installBrowserosAgent = () => {
  ensureDirectory(BASE_DIR);
  ensureDirectory(LOG_DIR);
  ensureDirectory(STATE_DIR);

  cloneOrUpdateRepository(BROWSEROS_REPO_URL, BROWSEROS_REPO_DIR);
  cloneOrUpdateRepository(BROWSEROS_AGENT_REPO_URL, AGENT_REPO_DIR);

  run(resolveBun(), ['install'], { cwd: AGENT_REPO_DIR });

  const envMap = readManagedEnv();
  const envContents = stringifyEnvMap(envMap);
  ensureDirectory(path.dirname(ENV_FILE_PATH));
  fs.writeFileSync(ENV_FILE_PATH, envContents, 'utf8');

  ensureLauncher();
};

const readPid = () => {
  if (!fs.existsSync(PID_PATH)) return null;
  const value = Number.parseInt(String(fs.readFileSync(PID_PATH, 'utf8')).trim(), 10);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
};

const writePid = (pid) => {
  ensureDirectory(path.dirname(PID_PATH));
  fs.writeFileSync(PID_PATH, String(pid), 'utf8');
};

const removePid = () => {
  if (fs.existsSync(PID_PATH)) {
    fs.unlinkSync(PID_PATH);
  }
};

const stopExisting = () => {
  const pid = readPid();
  if (pid && isProcessAlive(pid)) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // ignore and continue fallback kill
    }
  }

  const killResult = spawnSync('pkill', ['-f', LAUNCHER_PATH], { stdio: 'ignore' });
  if (killResult.status !== 0 && killResult.status !== 1) {
    // ignore uncommon failure states and continue
  }
  removePid();
};

const readCdpPid = () => {
  if (!fs.existsSync(CDP_PID_PATH)) return null;
  const value = Number.parseInt(String(fs.readFileSync(CDP_PID_PATH, 'utf8')).trim(), 10);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
};

const writeCdpPid = (pid) => {
  ensureDirectory(path.dirname(CDP_PID_PATH));
  fs.writeFileSync(CDP_PID_PATH, String(pid), 'utf8');
};

const removeCdpPid = () => {
  if (fs.existsSync(CDP_PID_PATH)) {
    fs.unlinkSync(CDP_PID_PATH);
  }
};

const stopManagedCdp = () => {
  const pid = readCdpPid();
  if (pid && isProcessAlive(pid)) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // ignore and continue
    }
  }
  removeCdpPid();
};

const resolveCdpBrowserBinary = () => {
  const explicit = String(process.env.BROWSEROS_CDP_BROWSER_BINARY || process.env.KRONOSCHAMBER_BROWSEROS_CDP_BROWSER_BINARY || '').trim();
  if (explicit) {
    return explicit;
  }

  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  for (const bin of ['google-chrome', 'chromium', 'chromium-browser', 'msedge']) {
    const found = spawnSync('which', [bin], { stdio: 'pipe', encoding: 'utf8' });
    if (found.status === 0) {
      const resolved = String(found.stdout || '').trim().split(/\s+/)[0];
      if (resolved) {
        return resolved;
      }
    }
  }

  return null;
};

const detectRunningCdpPort = async (preferredPort) => {
  const candidates = [preferredPort, ...CDP_DISCOVERY_PORTS].filter((value, index, array) => array.indexOf(value) === index);
  for (const candidate of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const ready = await waitForCdp(candidate, 1200);
    if (ready) {
      return candidate;
    }
  }
  return null;
};

const ensureCdpBrowser = async (requestedPort) => {
  const cdpPort = toInt(requestedPort, resolveCdpPort());
  const discovered = await detectRunningCdpPort(cdpPort);
  if (discovered) {
    return { cdpPort: discovered, cdpReady: true, cdpManaged: false, cdpBrowserBinary: null };
  }

  if (hasExplicitCdpPort() && cdpPort !== DEFAULT_CDP_PORT) {
    return { cdpPort, cdpReady: false, cdpManaged: false, cdpBrowserBinary: null };
  }

  const alreadyReady = await waitForCdp(cdpPort, 1500);
  if (alreadyReady) {
    return { cdpPort, cdpReady: true, cdpManaged: false, cdpBrowserBinary: null };
  }

  if (!resolveAutoStartCdp()) {
    return { cdpPort, cdpReady: false, cdpManaged: false, cdpBrowserBinary: null };
  }

  stopManagedCdp();

  const browserBinary = resolveCdpBrowserBinary();
  if (!browserBinary) {
    throw new Error(
      'No local Chromium browser binary found for BrowserOS CDP bootstrap. Set BROWSEROS_CDP_BROWSER_BINARY or install Chrome/Chromium.',
    );
  }

  const profileDir = path.join(STATE_DIR, 'browseros-cdp-profile');
  ensureDirectory(profileDir);
  const logFd = fs.openSync(CDP_LOG_PATH, 'a');
  const args = [
    `--remote-debugging-port=${cdpPort}`,
    '--remote-debugging-address=127.0.0.1',
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    'about:blank',
  ];
  const child = spawn(browserBinary, args, {
    cwd: HOME,
    env: process.env,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });
  child.unref();
  if (!child.pid) {
    throw new Error('Failed to launch local Chromium browser for BrowserOS CDP');
  }

  writeCdpPid(child.pid);
  const ready = await waitForCdp(cdpPort, 20000);
  if (!ready) {
    stopManagedCdp();
    throw new Error(
      `BrowserOS CDP bootstrap failed on port ${cdpPort}. Browser started but /json/version is unavailable.`,
    );
  }

  return { cdpPort, cdpReady: true, cdpManaged: true, cdpBrowserBinary: browserBinary };
};

const startBrowserosAgent = async () => {
  installBrowserosAgent();
  stopExisting();
  const cdp = await ensureCdpBrowser(resolveCdpPort());
  const effectiveCdpPort = toInt(cdp?.cdpPort, resolveCdpPort());

  if (!cdp?.cdpReady) {
    throw new Error(
      `BrowserOS CDP bootstrap failed on port ${effectiveCdpPort}. Configure BROWSEROS_CDP_PORT to a reachable CDP endpoint or enable local bootstrap.`,
    );
  }

  const logFd = fs.openSync(LOG_PATH, 'a');
  const child = spawn(LAUNCHER_PATH, [], {
    cwd: AGENT_REPO_DIR,
    env: {
      ...process.env,
      BROWSEROS_CDP_PORT: String(effectiveCdpPort),
      BROWSEROS_SERVER_PORT: String(resolveServerPort()),
      BROWSEROS_EXTENSION_PORT: String(resolveExtensionPort()),
    },
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });
  child.unref();

  if (!child.pid) {
    throw new Error('Failed to launch BrowserOS agent server');
  }

  writePid(child.pid);

  const serverPort = resolveServerPort();
  const healthUrl = `http://127.0.0.1:${serverPort}/health`;
  const healthy = await waitForHealth(healthUrl, 30000);

  return {
    pid: child.pid,
    healthy,
    healthUrl,
    cdp,
  };
};

const stopBrowserosAgent = () => {
  stopExisting();
  stopManagedCdp();
  return { stopped: true };
};

const statusPayload = async () => {
  const serverPort = resolveServerPort();
  const mcpUrl = `http://127.0.0.1:${serverPort}/mcp`;
  const healthUrl = `http://127.0.0.1:${serverPort}/health`;
  const cdpPort = resolveCdpPort();
  const discoveredCdpPort = await detectRunningCdpPort(cdpPort);
  const effectiveCdpPort = discoveredCdpPort ?? cdpPort;
  const cdpUrl = `http://127.0.0.1:${effectiveCdpPort}/json/version`;
  const installed =
    fs.existsSync(path.join(BROWSEROS_REPO_DIR, '.git')) &&
    fs.existsSync(path.join(AGENT_REPO_DIR, '.git')) &&
    fs.existsSync(LAUNCHER_PATH);

  const pid = readPid();
  const alive = pid ? isProcessAlive(pid) : false;
  const healthy = await httpCheck(healthUrl, 2000);
  const cdpReady = await httpCheck(cdpUrl, 2000);
  const cdpPid = readCdpPid();
  const cdpManaged = Boolean(cdpPid && isProcessAlive(cdpPid));

  return {
    installed,
    running: alive || healthy,
    healthy,
    pid: alive ? pid : null,
    repoPath: BROWSEROS_REPO_DIR,
    agentRepoPath: AGENT_REPO_DIR,
    launcherPath: LAUNCHER_PATH,
    envFilePath: ENV_FILE_PATH,
    logPath: LOG_PATH,
    serverPort,
    cdpPort: effectiveCdpPort,
    cdpReady,
    cdpManaged,
    cdpPid: cdpManaged ? cdpPid : null,
    cdpUrl,
    cdpLogPath: CDP_LOG_PATH,
    extensionPort: resolveExtensionPort(),
    mcpUrl,
    healthUrl,
  };
};

const runMode = async (mode) => {
  switch (mode) {
    case 'install':
      installBrowserosAgent();
      return statusPayload();
    case 'start': {
      const start = await startBrowserosAgent();
      const status = await statusPayload();
      return {
        ...status,
        started: true,
        start,
      };
    }
    case 'stop': {
      const stop = stopBrowserosAgent();
      const status = await statusPayload();
      return {
        ...status,
        stopped: true,
        stop,
      };
    }
    case 'status':
    default:
      return statusPayload();
  }
};

const mode = String(process.argv[2] || 'status').trim().toLowerCase();

try {
  if (!['status', 'install', 'start', 'stop'].includes(mode)) {
    throw new Error(`Unsupported mode: ${mode}`);
  }
  const payload = await runMode(mode);
  process.stdout.write(`${JSON.stringify(payload)}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
