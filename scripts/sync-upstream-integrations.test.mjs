import { describe, expect, it } from 'bun:test';

import { __syncIntegrationTestUtils } from './sync-upstream-integrations.mjs';

describe('sync-upstream-integrations license guards', () => {
  it('detects GPL license strings', () => {
    expect(__syncIntegrationTestUtils.isGplLicense('GPL-3.0')).toBe(true);
    expect(__syncIntegrationTestUtils.isGplLicense('MIT')).toBe(false);
  });

  it('rejects GPL imports for any repo', () => {
    expect(() =>
      __syncIntegrationTestUtils.assertImportAllowed({
        repoName: 'pluely',
        sourcePath: '/tmp/repo/src/index.ts',
        license: 'GPL-3.0',
      }),
    ).toThrow(/GPL-licensed content/);
  });

  it('rejects screenpipe ee paths', () => {
    expect(() =>
      __syncIntegrationTestUtils.assertImportAllowed({
        repoName: 'screenpipe',
        sourcePath: '/tmp/screenpipe/ee/private/feature.ts',
        license: 'MIT',
      }),
    ).toThrow(/screenpipe\/ee/);
  });

  it('allows MIT imports outside restricted paths', () => {
    expect(() =>
      __syncIntegrationTestUtils.assertImportAllowed({
        repoName: 'openfang',
        sourcePath: '/tmp/openfang/crates/openfang-extensions/integrations/aws.toml',
        license: 'MIT',
      }),
    ).not.toThrow();
  });
});
