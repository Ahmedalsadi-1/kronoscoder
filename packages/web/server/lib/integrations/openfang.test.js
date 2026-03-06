import { describe, expect, it } from 'bun:test';

import { __openfangTestUtils, getOpenfangStatus, startOpenfangDaemon } from './openfang.js';

describe('openfang integration normalizers', () => {
  it('normalizes stdio presets with env vars and tags', () => {
    const normalized = __openfangTestUtils.normalizePreset({
      id: 'aws',
      name: 'AWS',
      description: 'AWS MCP',
      transport: {
        type: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-aws', 10, null],
      },
      requiredEnv: [
        { name: 'AWS_ACCESS_KEY_ID', label: 'Access key', isSecret: true },
        { name: '', label: 'ignored' },
      ],
      oauthMeta: { provider: 'aws' },
      tags: ['cloud', 1, null],
      setupInstructions: 'Install dependencies',
      source: 'openfang:aws',
    });

    expect(normalized).toMatchObject({
      id: 'aws',
      name: 'AWS',
      transport: 'stdio',
      command: 'npx',
      args: ['@modelcontextprotocol/server-aws'],
      setupInstructions: 'Install dependencies',
      source: 'openfang:aws',
    });
    expect(normalized.requiredEnv).toEqual([
      {
        name: 'AWS_ACCESS_KEY_ID',
        label: 'Access key',
        help: '',
        isSecret: true,
        getUrl: '',
      },
    ]);
    expect(normalized.tags).toEqual(['cloud']);
  });

  it('normalizes remote presets and keeps url only for remote transport', () => {
    const normalized = __openfangTestUtils.normalizePreset({
      id: 'github-remote',
      name: 'GitHub Remote',
      transport: {
        type: 'remote',
        url: 'https://example.com/mcp',
        command: 'ignored',
        args: ['also-ignored'],
      },
    });

    expect(normalized.transport).toBe('remote');
    expect(normalized.url).toBe('https://example.com/mcp');
    expect(normalized.command).toBeUndefined();
  });

  it('normalizes hand templates and derives fallback prompt body', () => {
    const normalized = __openfangTestUtils.normalizeHandTemplate({
      id: 'reviewer',
      name: 'Code Reviewer',
      description: 'Review pull requests',
      category: 'engineering',
      icon: '🔍',
      tools: ['github', 1],
      settings: [{ id: 'strictness', type: 'select' }],
      requirements: ['repo access'],
      skillMarkdown: '  ',
      agent: {
        systemPrompt: 'Review changes for bugs and regressions.',
      },
      source: 'openfang:hands/reviewer',
    });

    expect(normalized).toMatchObject({
      id: 'reviewer',
      name: 'Code Reviewer',
      category: 'engineering',
      icon: '🔍',
      tools: ['github'],
      promptBody: 'Review changes for bugs and regressions.',
      commandTemplate: '/hand reviewer',
      source: 'openfang:hands/reviewer',
    });

    expect(normalized.taskTemplate).toMatchObject({
      title: 'Code Reviewer task',
      description: 'Review pull requests',
      requiredTools: ['github'],
      requirements: ['repo access'],
    });
  });
});

describe('openfang cli adapter config', () => {
  it('resolves defaults for opt-in integration mode', () => {
    const config = __openfangTestUtils.resolveOpenfangConfig({});
    expect(config.enabled).toBe(false);
    expect(config.command).toBe('openfang');
    expect(config.autoConfigureMcp).toBe(false);
  });

  it('finds daemon url from nested daemon.json payloads', () => {
    const nested = {
      daemon: {
        api: {
          listen_addr: '127.0.0.1:4200',
        },
      },
    };
    expect(__openfangTestUtils.findDaemonUrlCandidate(nested)).toBe('http://127.0.0.1:4200');
  });

  it('builds stdio openfang mcp config from command override', () => {
    const config = __openfangTestUtils.buildOpenfangMcpConfig({
      openfangEnabled: true,
      openfangCliCommand: 'custom-openfang',
    });
    expect(config).toMatchObject({
      name: 'openfang',
      type: 'local',
      enabled: true,
      command: ['custom-openfang', 'mcp'],
    });
  });

  it('reports daemon health as healthy when probe endpoint is reachable', async () => {
    const calls = [];
    const status = await getOpenfangStatus(
      { openfangEnabled: true, openfangCliCommand: 'openfang' },
      {
        fetchImpl: async (url) => {
          calls.push(String(url));
          return new Response(JSON.stringify({ status: 'ok' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        },
      },
    );

    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]).toContain('/api/health');
    expect(status.daemonHealthy).toBe(true);
    expect(status.daemonStatus).toBe('ok');
  });

  it('fails start with explicit CLI_NOT_FOUND for missing command', async () => {
    await expect(startOpenfangDaemon({
      openfangEnabled: true,
      openfangCliCommand: 'definitely-not-a-real-openfang-command',
    })).rejects.toMatchObject({
      name: 'OpenfangError',
      code: 'CLI_NOT_FOUND',
    });
  });
});
