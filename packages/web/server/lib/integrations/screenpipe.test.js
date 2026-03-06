import { describe, expect, it } from 'bun:test';

import {
  __screenpipeTestUtils,
  buildScreenpipeContext,
  getScreenpipeStatus,
  resolveScreenpipeConfig,
  searchScreenpipe,
} from './screenpipe.js';

describe('screenpipe integration adapter', () => {
  it('derives default config values', () => {
    const config = resolveScreenpipeConfig({});
    expect(config.enabled).toBe(true);
    expect(config.baseUrl).toBe('http://127.0.0.1:3030');
    expect(config.autoContext).toBe(true);
    expect(config.timeoutMs).toBeGreaterThanOrEqual(1000);
  });

  it('normalizes search query payload', () => {
    const query = __screenpipeTestUtils.normalizeSearchQuery({
      q: '  find this  ',
      limit: 500,
      offset: -10,
      contentType: 'OCR',
      appName: 'Terminal',
    });

    expect(query.q).toBe('find this');
    expect(query.limit).toBe(200);
    expect(query.offset).toBe(0);
    expect(query.content_type).toBe('ocr');
    expect(query.app_name).toBe('Terminal');
  });

  it('normalizes search responses from upstream payload', async () => {
    const result = await searchScreenpipe(
      {
        screenpipeEnabled: true,
        screenpipeBaseUrl: 'http://127.0.0.1:3030',
      },
      { q: 'hello' },
      async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                type: 'OCR',
                content: {
                  id: 'frame-1',
                  text: 'Hello from screenpipe',
                  timestamp: '2026-03-06T15:00:00.000Z',
                  app_name: 'Cursor',
                  window_name: 'kronoscoder',
                },
              },
            ],
            pagination: {
              limit: 1,
              offset: 0,
              total: 1,
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'frame-1',
      type: 'ocr',
      appName: 'Cursor',
      windowName: 'kronoscoder',
      text: 'Hello from screenpipe',
    });
    expect(result.pagination.total).toBe(1);
  });

  it('builds context text from normalized results', async () => {
    const result = await buildScreenpipeContext(
      {
        screenpipeEnabled: true,
        screenpipeBaseUrl: 'http://127.0.0.1:3030',
      },
      { q: 'deploy', windowMinutes: 30, limit: 2 },
      async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                type: 'audio',
                content: {
                  id: 'chunk-1',
                  transcription: 'Deployment was rolled back due to 500 errors.',
                  timestamp: '2026-03-06T16:00:00.000Z',
                  app_name: 'Slack',
                  window_name: 'Incident Channel',
                },
              },
            ],
            pagination: { limit: 1, offset: 0, total: 1 },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
    );

    expect(result.windowMinutes).toBe(30);
    expect(result.context).toContain('[AUDIO]');
    expect(result.context).toContain('Incident Channel');
  });

  it('reports disabled status without calling upstream', async () => {
    const status = await getScreenpipeStatus({ screenpipeEnabled: false });
    expect(status).toMatchObject({
      enabled: false,
      healthy: false,
      status: 'disabled',
    });
  });

  it('throws normalized unreachable errors when upstream is down', async () => {
    await expect(
      searchScreenpipe(
        {
          screenpipeEnabled: true,
          screenpipeBaseUrl: 'http://127.0.0.1:3030',
        },
        { q: 'anything' },
        async () => {
          throw new Error('connection refused');
        },
      ),
    ).rejects.toMatchObject({
      name: 'ScreenpipeError',
      code: 'UNREACHABLE',
    });
  });
});
