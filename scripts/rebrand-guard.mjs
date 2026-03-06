#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();

const includeRoots = [
  'packages/ui/src/components',
  'packages/ui/src/hooks',
  'packages/ui/src/components/onboarding',
  'packages/kronoscode/src/cli',
  'packages/kronoscode/src/command',
];

const allowPathSubstrings = [
  'packages/desktop/src-tauri/src/main.rs',
  'packages/web/server/index.js',
];

const allowLineSnippets = [
  '@gitlab/opencode-gitlab-auth',
  'createOpencodeClient',
  'OpencodeClient',
  'RoutedOpencodeEvent',
  'setOpencodeBinary',
  'aIsOpencode',
  'bIsOpencode',
  'ensureOpencode',
  'openCode',
  'openchamber-desktop',
  'LEGACY',
];

const filePattern = /\.(ts|tsx|js|jsx|md|json)$/i;
const forbidden = /\b(opencode|openchamber)\b/i;

const walk = (rootDir) => {
  const output = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const next = stack.pop();
    if (!next) continue;
    if (!fs.existsSync(next)) continue;
    const entries = fs.readdirSync(next, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.turbo') {
        continue;
      }
      const full = path.join(next, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!filePattern.test(entry.name)) continue;
      output.push(full);
    }
  }
  return output;
};

const roots = includeRoots
  .map((relativePath) => path.join(repoRoot, relativePath))
  .filter((absolutePath) => fs.existsSync(absolutePath));

const findings = [];

for (const root of roots) {
  const files = walk(root);
  for (const file of files) {
    if (allowPathSubstrings.some((part) => file.includes(part))) {
      continue;
    }
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!forbidden.test(line)) continue;
      if (allowLineSnippets.some((snippet) => line.includes(snippet))) continue;
      findings.push({
        file,
        line: i + 1,
        text: line.trim(),
      });
    }
  }
}

const runtimeRouteChecks = [
  "app.get('/api/runtime/status'",
  "app.post('/api/runtime/task'",
  "app.get('/api/runtime/tasks'",
  "app.get('/api/runtime/task/:taskID'",
  "app.post('/api/runtime/browser/action'",
  "app.get('/api/runtime/browser/state'",
  "app.get('/api/runtime/browser/frame'",
];

const runtimeServerPath = path.join(repoRoot, 'packages/web/server/index.js');
if (fs.existsSync(runtimeServerPath)) {
  const runtimeSource = fs.readFileSync(runtimeServerPath, 'utf8');
  for (const signature of runtimeRouteChecks) {
    const count = runtimeSource.split(signature).length - 1;
    if (count === 1) continue;
    findings.push({
      file: runtimeServerPath,
      line: 0,
      text: `runtime route signature "${signature}" appears ${count} times (expected 1)`,
    });
  }
}

if (findings.length === 0) {
  console.log('rebrand-guard: no forbidden user-facing brand strings found');
  process.exit(0);
}

console.error('rebrand-guard: found forbidden brand strings in user-facing surfaces:');
for (const finding of findings) {
  const lineLabel = finding.line > 0 ? finding.line : '?';
  console.error(`- ${path.relative(repoRoot, finding.file)}:${lineLabel} ${finding.text}`);
}
process.exit(1);
