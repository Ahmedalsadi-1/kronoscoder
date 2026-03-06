import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Message, Part } from '@kronoscode-ai/sdk/v2';
import { __agentWorkSnapshotTestUtils } from './useAgentWorkSnapshot';

const toolPart = (tool: string, status: string, input: Record<string, unknown> = {}): Part => {
  return {
    type: 'tool',
    tool,
    state: {
      status,
      input,
      time: { start: 1000 },
    },
  } as unknown as Part;
};

describe('useAgentWorkSnapshot helpers', () => {
  it('prioritizes assistant path over tool and session directories', () => {
    const result = __agentWorkSnapshotTestUtils.resolveWorkingLocation({
      assistantPath: { cwd: '/assistant/cwd', root: '/assistant/root' },
      toolCandidate: {
        toolName: 'playwright_navigate',
        isRunning: true,
        startTime: 1000,
        cwd: '/tool/cwd',
        root: '/tool/root',
        runtimeTarget: 'https://example.com',
        hasMediaActivity: false,
      },
      sessionDirectory: '/session/cwd',
      currentDirectory: '/current/cwd',
    });

    assert.equal(result.cwd, '/assistant/cwd');
    assert.equal(result.root, '/assistant/root');
  });

  it('falls back from tool path to session path when assistant path is absent', () => {
    const withTool = __agentWorkSnapshotTestUtils.resolveWorkingLocation({
      assistantPath: { cwd: null, root: null },
      toolCandidate: {
        toolName: 'shell_exec',
        isRunning: true,
        startTime: 2000,
        cwd: '/tool/cwd',
        root: '/tool/root',
        runtimeTarget: null,
        hasMediaActivity: false,
      },
      sessionDirectory: '/session/cwd',
      currentDirectory: '/current/cwd',
    });

    assert.equal(withTool.cwd, '/tool/cwd');
    assert.equal(withTool.root, '/tool/root');

    const withSession = __agentWorkSnapshotTestUtils.resolveWorkingLocation({
      assistantPath: { cwd: null, root: null },
      toolCandidate: null,
      sessionDirectory: '/session/cwd',
      currentDirectory: '/current/cwd',
    });

    assert.equal(withSession.cwd, '/session/cwd');
    assert.equal(withSession.root, '/session/cwd');
  });

  it('prefers running tool when multiple tool events overlap', () => {
    const messages: Array<{ info: Message; parts: Part[] }> = [
      {
        info: { role: 'assistant', id: 'older' } as unknown as Message,
        parts: [toolPart('playwright_navigate', 'running', { cwd: '/older' })],
      },
      {
        info: { role: 'assistant', id: 'newer' } as unknown as Message,
        parts: [toolPart('eslint', 'done', { cwd: '/newer' })],
      },
    ];

    const candidate = __agentWorkSnapshotTestUtils.pickToolCandidate(messages);
    assert.ok(candidate);
    assert.equal(candidate.toolName, 'playwright_navigate');
    assert.equal(candidate.cwd, '/older');
  });

  it('classifies work types deterministically from tool/runtime context', () => {
    assert.equal(__agentWorkSnapshotTestUtils.classifyWorkType('idle', 'playwright', null), 'idle');
    assert.equal(__agentWorkSnapshotTestUtils.classifyWorkType('running', 'playwright_navigate', null), 'browsing');
    assert.equal(__agentWorkSnapshotTestUtils.classifyWorkType('running', 'android_tap', null), 'mobile');
    assert.equal(__agentWorkSnapshotTestUtils.classifyWorkType('running', 'perplexity_search', null), 'research');
    assert.equal(__agentWorkSnapshotTestUtils.classifyWorkType('running', 'bun_test', null), 'validation');
    assert.equal(__agentWorkSnapshotTestUtils.classifyWorkType('running', 'edit_file', null), 'coding');
  });

  it('uses session status metadata first and falls back to derived values', () => {
    const derivedTool = __agentWorkSnapshotTestUtils.deriveToolName(
      { activeTool: 'status.active.tool' },
      {
        toolName: 'tool.candidate',
        isRunning: true,
        startTime: 1,
        cwd: null,
        root: null,
        runtimeTarget: null,
        hasMediaActivity: false,
      },
      null,
    );
    assert.equal(derivedTool, 'status.active.tool');

    const workType = __agentWorkSnapshotTestUtils.deriveWorkType(
      'running',
      { workType: 'mobile' },
      'playwright_navigate',
      null,
    );
    assert.equal(workType, 'mobile');

    const runtimeTarget = __agentWorkSnapshotTestUtils.deriveStatusRuntimeTarget(
      { runtimeTarget: 'https://status-target.example' },
      null,
      null,
    );
    assert.equal(runtimeTarget, 'https://status-target.example');
  });
});
