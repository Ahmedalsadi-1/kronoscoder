#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');
const desktopDir = path.join(repoRoot, 'packages/desktop');

function spawnProcess(command, args, opts = {}) {
  return spawn(command, args, {
    cwd: repoRoot,
    env: { ...process.env },
    stdio: 'inherit',
    ...opts,
  });
}

async function main() {
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

  const tauriProcess = spawnProcess('bun', [
    '--cwd',
    desktopDir,
    'tauri',
    'dev',
    '--features',
    'devtools',
    '--config',
    './src-tauri/tauri.dev.conf.json',
  ]);

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
