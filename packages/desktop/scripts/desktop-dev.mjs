#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const desktopDir = path.join(repoRoot, 'packages/desktop');
const browserosChamberHelperPath = path.join(repoRoot, 'scripts/setup-browseros-chamber.mjs');

const randomPortInRange = (min, max) => {
  const span = max - min + 1;
  return min + Math.floor(Math.random() * span);
};

const isPortAvailable = (port) =>
  new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });

const pickAvailablePortInRange = async (min, max) => {
  const span = max - min + 1;
  for (let attempt = 0; attempt < span; attempt += 1) {
    const candidate = randomPortInRange(min, max);
    // eslint-disable-next-line no-await-in-loop
    const available = await isPortAvailable(candidate);
    if (available) {
      return candidate;
    }
  }
  throw new Error(`Unable to allocate a free port in range ${min}-${max}`);
};

const parseJsonOutput = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    throw new Error('Missing JSON output from setup-browseros-chamber.mjs');
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Failed to parse setup-browseros-chamber.mjs output: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const runBrowserosChamber = (action, env) => {
  const result = spawnSync(process.execPath, [browserosChamberHelperPath, action], {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = String(result.stderr || '').trim();
    const stdout = String(result.stdout || '').trim();
    const detail = stderr || stdout || `exit code ${result.status ?? 'unknown'}`;
    throw new Error(`BrowserOS chamber ${action} failed: ${detail}`);
  }
  return parseJsonOutput(result.stdout);
};

function spawnProcess(command, args, opts = {}) {
  return spawn(command, args, {
    cwd: repoRoot,
    env: { ...process.env },
    stdio: 'inherit',
    ...opts,
  });
}

async function main() {
  const embeddedServerPort = await pickAvailablePortInRange(31000, 31999);
  const embeddedBootstrap = runBrowserosChamber('start', {
    BROWSEROS_CHAMBER_MODE: 'embedded',
    BROWSEROS_PROFILE: 'embedded',
    BROWSEROS_SERVER_PORT: String(embeddedServerPort),
    BROWSEROS_CDP_PORT: '0',
    BROWSEROS_AUTO_START_CDP: '0',
  });
  const embeddedMcpUrl =
    typeof embeddedBootstrap?.mcpUrl === 'string' && embeddedBootstrap.mcpUrl.trim().length > 0
      ? embeddedBootstrap.mcpUrl.trim()
      : `http://127.0.0.1:${embeddedServerPort}/mcp`;

  const readCompatValue = (name, legacy) => (typeof process.env[name] === 'string' ? process.env[name] : process.env[legacy]);
  const prebuildEnv = {
    ...process.env,
    KRONOSCHAMBER_DESKTOP_SKIP_RESOURCE_SYNC: '1',
    KRONOSCHAMBER_DESKTOP_SKIP_WEB_BUILD: '1',
    // TODO(compat): remove legacy aliases after one stable release.
    OPENCHAMBER_DESKTOP_SKIP_RESOURCE_SYNC: '1',
    OPENCHAMBER_DESKTOP_SKIP_WEB_BUILD: '1',
  };
  if (typeof readCompatValue('KRONOSCHAMBER_DESKTOP_SKIP_SIDECAR_BUILD', 'OPENCHAMBER_DESKTOP_SKIP_SIDECAR_BUILD') === 'string') {
    prebuildEnv.KRONOSCHAMBER_DESKTOP_SKIP_SIDECAR_BUILD = readCompatValue(
      'KRONOSCHAMBER_DESKTOP_SKIP_SIDECAR_BUILD',
      'OPENCHAMBER_DESKTOP_SKIP_SIDECAR_BUILD',
    );
    prebuildEnv.OPENCHAMBER_DESKTOP_SKIP_SIDECAR_BUILD = prebuildEnv.KRONOSCHAMBER_DESKTOP_SKIP_SIDECAR_BUILD;
  }
  const prebuild = spawnSync('node', ['./packages/desktop/scripts/build-sidecar.mjs'], {
    cwd: repoRoot,
    env: prebuildEnv,
    stdio: 'inherit',
  });
  if (prebuild.error) {
    throw prebuild.error;
  }
  if (prebuild.status !== 0) {
    throw new Error(`Sidecar prebuild failed with status ${prebuild.status}`);
  }

  const tauriEnv = {
    ...process.env,
    BROWSEROS_CHAMBER_MODE: 'embedded',
    BROWSEROS_PROFILE: 'embedded',
    BROWSEROS_SERVER_PORT: String(embeddedServerPort),
    BROWSEROS_CDP_PORT: '0',
    BROWSEROS_MCP_URL: embeddedMcpUrl,
    KRONOSCHAMBER_BROWSEROS_HELPER_PATH: browserosChamberHelperPath,
    KRONOSCHAMBER_BROWSEROS_EMBEDDED_PROFILE: 'embedded',
    KRONOSCHAMBER_NODE_BINARY: process.execPath,
  };

  const tauriProcess = spawnProcess(
    'bun',
    [
      '--cwd',
      desktopDir,
      'tauri',
      'dev',
      '--features',
      'devtools',
      '--config',
      './src-tauri/tauri.dev.conf.json',
    ],
    {
      env: tauriEnv,
    },
  );

  let cleaning = false;

  const teardown = async (code) => {
    if (cleaning) {
      return;
    }
    cleaning = true;

    const stopChild = (child, label) => {
      if (!child || child.killed) {
        return;
      }
      try {
        child.kill('SIGINT');
      } catch (error) {
        console.warn(`[desktop:dev] Failed to stop ${label}:`, error);
      }
    };

    stopChild(tauriProcess, 'Tauri dev process');
    try {
      runBrowserosChamber('stop', {
        BROWSEROS_CHAMBER_MODE: 'embedded',
        BROWSEROS_PROFILE: 'embedded',
        BROWSEROS_SERVER_PORT: String(embeddedServerPort),
        BROWSEROS_CDP_PORT: '0',
      });
    } catch (error) {
      console.warn('[desktop:dev] Failed to stop embedded BrowserOS chamber:', error);
    }

    process.exit(typeof code === 'number' ? code : 0);
  };

  const handleChildExit = (childName) => (code, signal) => {
    if (code !== 0 || signal) {
      console.warn(`[desktop:dev] ${childName} exited with code ${code ?? 'null'} signal ${signal ?? 'none'}.`);
    }
    teardown(code).catch((error) => {
      console.error('[desktop:dev] Cleanup error:', error);
      process.exit(code ?? 1);
    });
  };

  tauriProcess.on('exit', handleChildExit('Tauri dev process'));
  const errorHandler = (label) => (error) => {
    console.error(`[desktop:dev] Failed to start ${label}:`, error);
    teardown(1).catch(() => process.exit(1));
  };

  tauriProcess.on('error', errorHandler('Tauri dev process'));

  const signalExitCodes = {
    SIGINT: 130,
    SIGTERM: 143,
    SIGQUIT: 131,
  };

  Object.entries(signalExitCodes).forEach(([signal, exitCode]) => {
    process.on(signal, () => {
      teardown(exitCode).catch(() => process.exit(exitCode));
    });
  });
}

main().catch((error) => {
  console.error('[desktop:dev] Unexpected error:', error);
  process.exit(1);
});
