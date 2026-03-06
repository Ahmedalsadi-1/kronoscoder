import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { orderRuntimeHosts, resolveBestRuntimeHost, type RuntimeHost } from './runtimeHostResolver';

const HOSTS: RuntimeHost[] = [
  { id: 'alpha', label: 'Alpha', url: 'https://alpha.example.com' },
  { id: 'beta', label: 'Beta', url: 'https://beta.example.com' },
  { id: 'gamma', label: 'Gamma', url: 'https://gamma.example.com' },
];

describe('runtimeHostResolver', () => {
  it('orders hosts by default host id when present', () => {
    const ordered = orderRuntimeHosts(HOSTS, 'beta');
    assert.deepEqual(ordered.map((host) => host.id), ['beta', 'alpha', 'gamma']);
  });

  it('keeps host order when default host id is missing', () => {
    const ordered = orderRuntimeHosts(HOSTS, 'unknown');
    assert.deepEqual(ordered.map((host) => host.id), ['alpha', 'beta', 'gamma']);
  });

  it('returns first reachable host in configured order', async () => {
    const resolved = await resolveBestRuntimeHost(HOSTS, async (host) => {
      if (host.id === 'alpha') {
        return { status: 'unreachable', latencyMs: 12 };
      }
      if (host.id === 'beta') {
        return { status: 'auth', latencyMs: 23 };
      }
      return { status: 'ok', latencyMs: 9 };
    });

    assert.notEqual(resolved, 'local');
    if (resolved !== 'local') {
      assert.equal(resolved.id, 'beta');
    }
  });

  it('falls back to local when no host is reachable', async () => {
    const resolved = await resolveBestRuntimeHost(HOSTS, async () => {
      return { status: 'unreachable', latencyMs: 0 };
    });
    assert.equal(resolved, 'local');
  });
});
