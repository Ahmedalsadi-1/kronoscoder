import { promises as fs } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const GENERATED_ROOT = path.join(REPO_ROOT, 'third_party', 'generated');
const PRESETS_PATH = path.join(GENERATED_ROOT, 'openfang-mcp-presets.json');
const HANDS_PATH = path.join(GENERATED_ROOT, 'openfang-hand-templates.json');
const OPENFANG_DEFAULT_COMMAND = 'openfang';
const OPENFANG_DEFAULT_DAEMON_URL = 'http://127.0.0.1:4200';
const OPENFANG_DEFAULT_TIMEOUT_MS = 5000;
const OPENFANG_DAEMON_JSON_PATH = path.join(os.homedir(), '.openfang', 'daemon.json');

class OpenfangError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'OpenfangError';
    this.code = code;
    this.statusCode = options.statusCode ?? null;
    this.cause = options.cause;
    this.details = options.details ?? null;
  }
}

let cache = {
  presets: { mtimeMs: 0, value: [] },
  hands: { mtimeMs: 0, value: [] },
};

let managedOpenfang = {
  child: null,
  command: OPENFANG_DEFAULT_COMMAND,
  args: ['start'],
  startedAt: null,
};
let lastManagedError = null;

const clampInteger = (value, fallback, min, max) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
};

const normalizeBoolean = (value, fallback) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
};

const normalizeOptionalString = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const extractCommandBinary = (command) => {
  const normalized = normalizeOptionalString(command);
  if (!normalized) return '';

  if (normalized.startsWith('"')) {
    const end = normalized.indexOf('"', 1);
    if (end > 1) {
      return normalized.slice(1, end);
    }
  }
  if (normalized.startsWith('\'')) {
    const end = normalized.indexOf('\'', 1);
    if (end > 1) {
      return normalized.slice(1, end);
    }
  }
  return normalized.split(/\s+/)[0] ?? '';
};

const isCommandOnPath = (command) => {
  const binary = extractCommandBinary(command);
  if (!binary) {
    return false;
  }

  try {
    const lookup = process.platform === 'win32' ? 'where' : 'which';
    const result = spawnSync(lookup, [binary], { stdio: 'ignore' });
    return result.status === 0;
  } catch {
    return false;
  }
};

const normalizeDaemonUrl = (value) => {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return `http://127.0.0.1:${Math.round(value)}`;
  }
  const candidate = normalizeOptionalString(value);
  if (!candidate) {
    return null;
  }
  if (/^\d+$/.test(candidate)) {
    return `http://127.0.0.1:${candidate}`;
  }
  if (!candidate.includes('://')) {
    return `http://${candidate.replace(/\/+$/, '')}`;
  }
  try {
    const parsed = new URL(candidate);
    if (!parsed.pathname || parsed.pathname === '/') {
      return parsed.origin;
    }
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
};

const findDaemonUrlCandidate = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const record = payload;
  const directKeys = [
    'url',
    'daemon_url',
    'daemonUrl',
    'api_url',
    'apiUrl',
    'listen_addr',
    'listenAddr',
    'listen_address',
    'listenAddress',
    'address',
    'listen',
    'port',
  ];

  for (const key of directKeys) {
    const candidate = normalizeDaemonUrl(record[key]);
    if (candidate) {
      return candidate;
    }
  }

  const nestedKeys = ['api', 'daemon', 'server', 'http'];
  for (const key of nestedKeys) {
    const nested = record[key];
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
      continue;
    }
    const nestedCandidate = findDaemonUrlCandidate(nested);
    if (nestedCandidate) {
      return nestedCandidate;
    }
  }

  return null;
};

const readDaemonFile = async (daemonJsonPath) => {
  try {
    const raw = await fs.readFile(daemonJsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const currentManagedProcess = () => {
  const child = managedOpenfang.child;
  const running = Boolean(child && child.exitCode === null && child.killed !== true);
  return {
    running,
    pid: running && typeof child.pid === 'number' ? child.pid : null,
    command: managedOpenfang.command,
    args: managedOpenfang.args,
    startedAt: managedOpenfang.startedAt,
  };
};

const attachManagedProcessListeners = (child) => {
  child.once('error', (error) => {
    lastManagedError = error instanceof Error ? error.message : 'OpenFang process failed to start';
  });

  child.once('exit', (_code, signal) => {
    if (managedOpenfang.child === child) {
      managedOpenfang = {
        ...managedOpenfang,
        child: null,
      };
    }
    if (signal && signal !== 'SIGTERM') {
      lastManagedError = `OpenFang process exited with signal ${signal}`;
    }
  });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readCachedJson = async (filePath, key) => {
  try {
    const stats = await fs.stat(filePath);
    const record = cache[key];
    if (record.mtimeMs === stats.mtimeMs && Array.isArray(record.value)) {
      return record.value;
    }

    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    const next = Array.isArray(parsed) ? parsed : [];
    cache = {
      ...cache,
      [key]: {
        mtimeMs: stats.mtimeMs,
        value: next,
      },
    };
    return next;
  } catch {
    return [];
  }
};

const normalizeRequiredEnv = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      name: typeof item.name === 'string' ? item.name : '',
      label: typeof item.label === 'string' ? item.label : '',
      help: typeof item.help === 'string' ? item.help : '',
      isSecret: Boolean(item.isSecret),
      getUrl: typeof item.getUrl === 'string' ? item.getUrl : '',
    }))
    .filter((item) => item.name.length > 0);
};

const normalizePreset = (entry) => {
  const transport = entry?.transport && typeof entry.transport === 'object' ? entry.transport : {};
  const args = Array.isArray(transport.args) ? transport.args.filter((item) => typeof item === 'string') : [];

  const type = transport.type === 'remote' ? 'remote' : 'stdio';
  const command = typeof transport.command === 'string' ? transport.command.trim() : '';
  const url = typeof transport.url === 'string' ? transport.url.trim() : '';

  return {
    id: typeof entry?.id === 'string' ? entry.id : '',
    name: typeof entry?.name === 'string' ? entry.name : '',
    description: typeof entry?.description === 'string' ? entry.description : '',
    transport: type,
    command: type === 'stdio' ? command : undefined,
    url: type === 'remote' ? url : undefined,
    args,
    requiredEnv: normalizeRequiredEnv(entry?.requiredEnv),
    oauth: entry?.oauthMeta && typeof entry.oauthMeta === 'object' ? entry.oauthMeta : null,
    tags: Array.isArray(entry?.tags) ? entry.tags.filter((item) => typeof item === 'string') : [],
    setupInstructions: typeof entry?.setupInstructions === 'string' ? entry.setupInstructions : '',
    source: typeof entry?.source === 'string' ? entry.source : 'openfang:unknown',
  };
};

const normalizeHandTemplate = (entry) => {
  const settings = Array.isArray(entry?.settings) ? entry.settings : [];
  const requirements = Array.isArray(entry?.requirements) ? entry.requirements : [];
  const tools = Array.isArray(entry?.tools) ? entry.tools.filter((item) => typeof item === 'string') : [];

  const promptBody = typeof entry?.skillMarkdown === 'string' && entry.skillMarkdown.trim().length > 0
    ? entry.skillMarkdown.trim()
    : typeof entry?.agent?.systemPrompt === 'string'
      ? entry.agent.systemPrompt.trim()
      : '';

  return {
    id: typeof entry?.id === 'string' ? entry.id : '',
    name: typeof entry?.name === 'string' ? entry.name : '',
    description: typeof entry?.description === 'string' ? entry.description : '',
    category: typeof entry?.category === 'string' ? entry.category : null,
    icon: typeof entry?.icon === 'string' ? entry.icon : null,
    tools,
    settings,
    requirements,
    promptBody,
    taskTemplate: {
      title: typeof entry?.name === 'string' && entry.name.trim().length > 0 ? `${entry.name} task` : 'OpenFang hand task',
      description: typeof entry?.description === 'string' ? entry.description : '',
      requiredTools: tools,
      requirements,
    },
    commandTemplate: `/hand ${typeof entry?.id === 'string' ? entry.id : 'unknown'}`,
    source: typeof entry?.source === 'string' ? entry.source : 'openfang:unknown',
  };
};

export const loadOpenfangMcpPresets = async () => {
  const raw = await readCachedJson(PRESETS_PATH, 'presets');
  return raw.map(normalizePreset).filter((entry) => entry.id.length > 0 && entry.name.length > 0);
};

export const loadOpenfangHandTemplates = async () => {
  const raw = await readCachedJson(HANDS_PATH, 'hands');
  return raw.map(normalizeHandTemplate).filter((entry) => entry.id.length > 0 && entry.name.length > 0);
};

export const resolveOpenfangConfig = (settings = {}) => {
  const envEnabled = normalizeBoolean(process.env.KRONOSCHAMBER_OPENFANG_ENABLED, undefined);
  const enabled = envEnabled ?? normalizeBoolean(settings.openfangEnabled, false);
  const command =
    normalizeOptionalString(process.env.KRONOSCHAMBER_OPENFANG_CLI_COMMAND) ??
    normalizeOptionalString(settings.openfangCliCommand) ??
    OPENFANG_DEFAULT_COMMAND;
  const autoConfigureMcp = normalizeBoolean(settings.openfangAutoConfigureMcp, false);

  return {
    enabled,
    command,
    autoConfigureMcp,
    daemonJsonPath: OPENFANG_DAEMON_JSON_PATH,
    timeoutMs: clampInteger(
      process.env.KRONOSCHAMBER_OPENFANG_TIMEOUT_MS,
      OPENFANG_DEFAULT_TIMEOUT_MS,
      1000,
      30000,
    ),
  };
};

const resolveOpenfangDaemonUrl = async (settings = {}) => {
  const config = resolveOpenfangConfig(settings);
  const daemon = await readDaemonFile(config.daemonJsonPath);
  const candidate = findDaemonUrlCandidate(daemon);
  return candidate ?? OPENFANG_DEFAULT_DAEMON_URL;
};

const requestOpenfang = async (url, method, timeoutMs, fetchImpl = fetch) => {
  const endpoint = new URL('/api/health', `${url.replace(/\/+$/, '')}/`);

  try {
    const response = await fetchImpl(endpoint.toString(), {
      method,
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    const payload = text.length > 0 ? JSON.parse(text) : {};
    return {
      ok: response.ok,
      statusCode: response.status,
      payload,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new OpenfangError('TIMEOUT', 'OpenFang health probe timed out', { cause: error });
    }
    throw new OpenfangError('UNREACHABLE', 'Unable to reach OpenFang daemon', { cause: error });
  }
};

const probeOpenfangHealth = async (settings = {}, fetchImpl = fetch) => {
  const config = resolveOpenfangConfig(settings);
  const daemonUrl = await resolveOpenfangDaemonUrl(settings);
  const startedAt = Date.now();

  if (!config.enabled) {
    return {
      daemonUrl,
      healthy: false,
      status: 'disabled',
      details: null,
      latencyMs: 0,
    };
  }

  try {
    const result = await requestOpenfang(daemonUrl, 'GET', config.timeoutMs, fetchImpl);
    return {
      daemonUrl,
      healthy: result.ok,
      status: typeof result.payload?.status === 'string' ? result.payload.status : result.ok ? 'ok' : 'offline',
      details: result.payload,
      latencyMs: Date.now() - startedAt,
      statusCode: result.statusCode,
    };
  } catch (error) {
    return {
      daemonUrl,
      healthy: false,
      status: 'offline',
      details: null,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'OpenFang daemon is unreachable',
    };
  }
};

const waitForOpenfangHealthy = async (settings = {}, maxAttempts = 18, fetchImpl = fetch) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const health = await probeOpenfangHealth(settings, fetchImpl);
    if (health.healthy) {
      return health;
    }
    await sleep(400);
  }
  return probeOpenfangHealth(settings, fetchImpl);
};

const waitForManagedExit = async (child, timeoutMs = 3000) => {
  await Promise.race([
    new Promise((resolve) => {
      child.once('exit', resolve);
    }),
    sleep(timeoutMs),
  ]);
};

const killManagedProcess = async () => {
  const child = managedOpenfang.child;
  if (!child || child.exitCode !== null) {
    return false;
  }

  child.kill('SIGTERM');
  await waitForManagedExit(child, 2500);
  if (child.exitCode === null) {
    child.kill('SIGKILL');
    await waitForManagedExit(child, 1000);
  }
  return true;
};

export const getOpenfangStatus = async (settings = {}, options = {}) => {
  const config = resolveOpenfangConfig(settings);
  const cliDetected = isCommandOnPath(config.command);
  const health = await probeOpenfangHealth(settings, options.fetchImpl ?? fetch);
  const managedProcess = currentManagedProcess();

  return {
    enabled: config.enabled,
    cliDetected,
    command: config.command,
    daemonHealthy: health.healthy,
    daemonUrl: health.daemonUrl,
    daemonStatus: health.status,
    managedProcess,
    lastError: lastManagedError,
  };
};

export const startOpenfangDaemon = async (settings = {}, options = {}) => {
  const config = resolveOpenfangConfig(settings);
  if (!config.enabled) {
    throw new OpenfangError('DISABLED', 'OpenFang integration is disabled');
  }
  if (!isCommandOnPath(config.command)) {
    throw new OpenfangError('CLI_NOT_FOUND', `OpenFang CLI command not found on PATH: ${config.command}`);
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const before = await probeOpenfangHealth(settings, fetchImpl);
  if (before.healthy) {
    return {
      started: false,
      reason: 'already_running',
      status: await getOpenfangStatus(settings, { fetchImpl }),
    };
  }

  const current = currentManagedProcess();
  if (!current.running) {
    const child = spawn(config.command, ['start'], {
      stdio: 'ignore',
      env: process.env,
    });
    managedOpenfang = {
      child,
      command: config.command,
      args: ['start'],
      startedAt: Date.now(),
    };
    attachManagedProcessListeners(child);
  }

  const health = await waitForOpenfangHealthy(settings, 18, fetchImpl);
  if (!health.healthy) {
    const message = `OpenFang daemon did not become healthy at ${health.daemonUrl}`;
    lastManagedError = message;
    throw new OpenfangError('START_TIMEOUT', message);
  }

  lastManagedError = null;
  return {
    started: true,
    reason: 'started',
    status: await getOpenfangStatus(settings, { fetchImpl }),
  };
};

export const stopOpenfangDaemon = async (settings = {}, options = {}) => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const before = await probeOpenfangHealth(settings, fetchImpl);
  const daemonUrl = before.daemonUrl;
  let shutdownRequested = false;

  if (before.healthy) {
    try {
      const endpoint = new URL('/api/shutdown', `${daemonUrl.replace(/\/+$/, '')}/`);
      await fetchImpl(endpoint.toString(), {
        method: 'POST',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(resolveOpenfangConfig(settings).timeoutMs),
      });
      shutdownRequested = true;
    } catch {
      // Ignore and continue with managed process kill fallback.
    }
  }

  const killedManaged = await killManagedProcess();
  if (managedOpenfang.child && managedOpenfang.child.exitCode !== null) {
    managedOpenfang = {
      ...managedOpenfang,
      child: null,
    };
  }

  const after = await waitForOpenfangHealthy(settings, 10, fetchImpl);
  return {
    stopped: !after.healthy,
    shutdownRequested,
    killedManaged,
    status: await getOpenfangStatus(settings, { fetchImpl }),
  };
};

export const buildOpenfangMcpConfig = (settings = {}) => {
  const config = resolveOpenfangConfig(settings);
  return {
    name: 'openfang',
    type: 'local',
    command: [config.command, 'mcp'],
    enabled: true,
  };
};

export const __openfangTestUtils = {
  normalizePreset,
  normalizeHandTemplate,
  normalizeDaemonUrl,
  findDaemonUrlCandidate,
  resolveOpenfangConfig,
  buildOpenfangMcpConfig,
};

export { OpenfangError };
