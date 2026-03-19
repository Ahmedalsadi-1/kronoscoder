#!/usr/bin/env node

import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AGENT_SETUP_SCRIPT_PATH = path.join(__dirname, 'setup-browseros-agent.mjs');

const SERVER_PORT_MIN = 31000;
const SERVER_PORT_MAX = 31999;
const BACKGROUND_CDP_PORT_MIN = 42000;
const BACKGROUND_CDP_PORT_MAX = 42999;
const ACTIONS = new Set(['status', 'install', 'start', 'stop']);
const MODES = new Set(['embedded', 'background']);

const parseCliArgs = (argv) => {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] ?? '').trim();
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    if (!key) continue;
    const next = String(argv[i + 1] ?? '');
    if (!next || next.startsWith('--')) {
      flags[key] = 'true';
      continue;
    }
    flags[key] = next;
    i += 1;
  }
  return flags;
};

const parsePort = (value, fallback, options = {}) => {
  const allowZero = options.allowZero === true;
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (Number.isFinite(parsed) && ((allowZero && parsed === 0) || (parsed > 0 && parsed <= 65535))) {
    return parsed;
  }
  return fallback;
};

const sanitizeProfile = (value, fallback) => {
  const raw = String(value ?? fallback ?? '').trim().toLowerCase();
  const normalized = raw.replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || fallback || 'default';
};

const isPortAvailable = async (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });

const pickRandomPortInRange = async (min, max) => {
  const span = max - min + 1;
  const seed = Date.now();
  for (let attempt = 0; attempt < span; attempt += 1) {
    const candidate = min + ((seed + attempt * 7919) % span);
    // eslint-disable-next-line no-await-in-loop
    const available = await isPortAvailable(candidate);
    if (available) {
      return candidate;
    }
  }
  throw new Error(`Unable to find available port in ${min}-${max}`);
};

const parseJsonStdout = (stdout) => {
  const text = String(stdout ?? '').trim();
  if (!text) {
    throw new Error('Missing JSON output from setup-browseros-agent.mjs');
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Failed to parse setup-browseros-agent.mjs output: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const runAgentSetup = (action, env) => {
  const result = spawnSync(process.execPath, [AGENT_SETUP_SCRIPT_PATH, action], {
    encoding: 'utf8',
    stdio: 'pipe',
    env: {
      ...process.env,
      ...env,
    },
  });

  if (result.status !== 0) {
    const stderr = String(result.stderr ?? '').trim();
    const stdout = String(result.stdout ?? '').trim();
    const detail = stderr || stdout || `exit code ${result.status ?? 'unknown'}`;
    throw new Error(`setup-browseros-agent.mjs ${action} failed: ${detail}`);
  }

  return parseJsonStdout(result.stdout);
};

const normalizeMode = (value) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return MODES.has(normalized) ? normalized : 'embedded';
};

const resolveAutoStartCdp = (mode, explicitValue) => {
  const raw = String(explicitValue ?? '').trim().toLowerCase();
  if (raw) {
    return !(raw === '0' || raw === 'false' || raw === 'no' || raw === 'off');
  }
  return true;
};

const main = async () => {
  const argv = process.argv.slice(2);
  const action = ACTIONS.has(String(argv[0] ?? '').trim().toLowerCase())
    ? String(argv[0]).trim().toLowerCase()
    : 'status';
  const flags = parseCliArgs(argv.slice(1));

  const mode = normalizeMode(
    flags.mode ??
      process.env.BROWSEROS_CHAMBER_MODE ??
      process.env.KRONOSCHAMBER_BROWSEROS_MODE ??
      'embedded',
  );
  const profile = sanitizeProfile(
    flags.profile ??
      process.env.BROWSEROS_PROFILE ??
      process.env.KRONOSCHAMBER_BROWSEROS_PROFILE ??
      (mode === 'background' ? 'background' : 'embedded'),
    mode === 'background' ? 'background' : 'embedded',
  );

  const explicitServerPort = flags['server-port'] ?? flags.serverPort ?? process.env.BROWSEROS_SERVER_PORT;
  const explicitCdpPort = flags['cdp-port'] ?? flags.cdpPort ?? process.env.BROWSEROS_CDP_PORT;
  const explicitExtensionPort =
    flags['extension-port'] ?? flags.extensionPort ?? process.env.BROWSEROS_EXTENSION_PORT;
  const explicitAutoStartCdp = flags['auto-start-cdp'] ?? process.env.BROWSEROS_AUTO_START_CDP;

  const serverPort =
    action === 'start'
      ? parsePort(explicitServerPort, await pickRandomPortInRange(SERVER_PORT_MIN, SERVER_PORT_MAX))
      : parsePort(explicitServerPort, null);
  const cdpPort =
    action === 'start'
      ? parsePort(
          explicitCdpPort,
          await pickRandomPortInRange(BACKGROUND_CDP_PORT_MIN, BACKGROUND_CDP_PORT_MAX),
          { allowZero: true },
        )
      : parsePort(explicitCdpPort, null, { allowZero: true });
  const extensionPort =
    action === 'start'
      ? parsePort(explicitExtensionPort, serverPort ? Math.min(serverPort + 1, 65535) : 9240)
      : parsePort(explicitExtensionPort, null);
  const autoStartCdp = resolveAutoStartCdp(mode, explicitAutoStartCdp);

  const env = {
    BROWSEROS_PROFILE: profile,
    KRONOSCHAMBER_BROWSEROS_PROFILE: profile,
    BROWSEROS_CHAMBER_MODE: mode,
    KRONOSCHAMBER_BROWSEROS_MODE: mode,
    ...(serverPort ? { BROWSEROS_SERVER_PORT: String(serverPort) } : {}),
    ...(cdpPort !== null ? { BROWSEROS_CDP_PORT: String(cdpPort) } : {}),
    ...(extensionPort ? { BROWSEROS_EXTENSION_PORT: String(extensionPort) } : {}),
    BROWSEROS_AUTO_START_CDP: autoStartCdp ? '1' : '0',
  };

  const payload = runAgentSetup(action, env);
  const resolvedServerPort = parsePort(payload?.serverPort ?? serverPort, null);
  const resolvedCdpPort = parsePort(payload?.cdpPort ?? cdpPort, null, { allowZero: true });
  const mcpUrl =
    typeof payload?.mcpUrl === 'string' && payload.mcpUrl.trim().length > 0
      ? payload.mcpUrl.trim()
      : resolvedServerPort
        ? `http://127.0.0.1:${resolvedServerPort}/mcp`
        : null;
  const healthUrl =
    typeof payload?.healthUrl === 'string' && payload.healthUrl.trim().length > 0
      ? payload.healthUrl.trim()
      : resolvedServerPort
        ? `http://127.0.0.1:${resolvedServerPort}/health`
        : null;

  process.stdout.write(
    `${JSON.stringify({
      ...payload,
      action,
      mode,
      profile,
      serverPort: resolvedServerPort,
      cdpPort: resolvedCdpPort,
      cdpDisabled: resolvedCdpPort === 0 || payload?.cdpDisabled === true,
      mcpUrl,
      healthUrl,
      helperScriptPath: path.resolve(__filename),
      setupScriptPath: AGENT_SETUP_SCRIPT_PATH,
    })}\n`,
  );
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
