import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { __predictiveSkillsPrewarmTestUtils, prewarmPredictiveSkills } from './predictiveSkillsPrewarm';

const flush = async () => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('predictiveSkillsPrewarm', () => {
  afterEach(() => {
    __predictiveSkillsPrewarmTestUtils.reset();
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it('fires a best-effort prewarm request and stores cache entry', async () => {
    let calls = 0;
    (globalThis as { fetch: typeof fetch }).fetch = (async () => {
      calls += 1;
      return { ok: true, status: 200 } as Response;
    }) as typeof fetch;

    prewarmPredictiveSkills({
      cwd: '/Users/me/project',
      agent: 'planner',
      reason: 'prompt_send',
    });

    await flush();

    assert.equal(calls, 1);
    assert.equal(__predictiveSkillsPrewarmTestUtils.cacheSize(), 1);
  });

  it('uses cache and in-flight dedupe for repeated prewarm calls', async () => {
    let calls = 0;
    let resolveGate: (value: void | PromiseLike<void>) => void = () => {};
    const gate = new Promise<void>((resolve) => {
      resolveGate = resolve;
    });

    (globalThis as { fetch: typeof fetch }).fetch = (async () => {
      calls += 1;
      await gate;
      return { ok: true, status: 200 } as Response;
    }) as typeof fetch;

    prewarmPredictiveSkills({ cwd: '/Users/me/project', agent: 'coder', reason: 'prompt_send' });
    prewarmPredictiveSkills({ cwd: '/Users/me/project', agent: 'coder', reason: 'prompt_send' });
    await flush();
    assert.equal(calls, 1);

    resolveGate();
    await flush();

    prewarmPredictiveSkills({ cwd: '/Users/me/project', agent: 'coder', reason: 'prompt_send' });
    await flush();
    assert.equal(calls, 1);
  });
});
