import { URL } from 'node:url';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3030';
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_LIMIT = 20;
const DEFAULT_CONTENT_TYPE = 'all';

class ScreenpipeError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'ScreenpipeError';
    this.code = code;
    this.statusCode = options.statusCode ?? null;
    this.cause = options.cause;
    this.details = options.details ?? null;
  }
}

const clampInteger = (value, fallback, min, max) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
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

const normalizeBaseUrl = (value) => {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) return DEFAULT_BASE_URL;
  try {
    const parsed = new URL(candidate);
    if (!parsed.pathname || parsed.pathname === '/') {
      return parsed.origin;
    }
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return DEFAULT_BASE_URL;
  }
};

const toIso = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const normalizeContentType = (value) => {
  const allowed = new Set(['all', 'ocr', 'audio', 'ui', 'input']);
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (allowed.has(normalized)) return normalized;
  return DEFAULT_CONTENT_TYPE;
};

const normalizeSearchQuery = (payload = {}) => {
  const limit = clampInteger(payload.limit, DEFAULT_LIMIT, 1, 200);
  const offset = clampInteger(payload.offset, 0, 0, 100000);
  const contentType = normalizeContentType(payload.contentType ?? payload.content_type);
  const query = {
    q: typeof payload.q === 'string' ? payload.q.trim() : '',
    limit,
    offset,
    content_type: contentType,
  };

  const startTime = toIso(payload.startTime ?? payload.start_time);
  const endTime = toIso(payload.endTime ?? payload.end_time);
  if (startTime) query.start_time = startTime;
  if (endTime) query.end_time = endTime;

  const appName = typeof payload.appName === 'string' ? payload.appName.trim() : '';
  const windowName = typeof payload.windowName === 'string' ? payload.windowName.trim() : '';
  const browserUrl = typeof payload.browserUrl === 'string' ? payload.browserUrl.trim() : '';
  const speakerName = typeof payload.speakerName === 'string' ? payload.speakerName.trim() : '';

  if (appName) query.app_name = appName;
  if (windowName) query.window_name = windowName;
  if (browserUrl) query.browser_url = browserUrl;
  if (speakerName) query.speaker_name = speakerName;

  if (typeof payload.focused === 'boolean') {
    query.focused = payload.focused ? 'true' : 'false';
  }

  return query;
};

const mapItem = (item, index) => {
  const typeRaw = typeof item?.type === 'string' ? item.type : 'unknown';
  const type = typeRaw.toLowerCase();
  const content = item?.content && typeof item.content === 'object' ? item.content : {};

  const text = typeof content.text === 'string'
    ? content.text
    : typeof content.transcription === 'string'
      ? content.transcription
      : typeof content.text_content === 'string'
        ? content.text_content
        : '';

  const timestamp = typeof content.timestamp === 'string' ? content.timestamp : null;
  const appName = typeof content.app_name === 'string' ? content.app_name : null;
  const windowName = typeof content.window_name === 'string' ? content.window_name : null;
  const browserUrl = typeof content.browser_url === 'string' ? content.browser_url : null;

  const id =
    content.frame_id ??
    content.chunk_id ??
    content.id ??
    `${type}-${index}`;

  return {
    id: String(id),
    type,
    timestamp,
    appName,
    windowName,
    browserUrl,
    text,
    raw: item,
  };
};

const normalizeSearchResponse = (payload) => {
  const data = Array.isArray(payload?.data) ? payload.data : [];
  const pagination = payload?.pagination && typeof payload.pagination === 'object' ? payload.pagination : {};

  return {
    items: data.map((item, index) => mapItem(item, index)),
    pagination: {
      limit: Number.isFinite(pagination.limit) ? pagination.limit : data.length,
      offset: Number.isFinite(pagination.offset) ? pagination.offset : 0,
      total: Number.isFinite(pagination.total) ? pagination.total : data.length,
    },
  };
};

const formatContextText = (items, options = {}) => {
  const maxItems = clampInteger(options.maxItems, 12, 1, 50);
  const selected = items.slice(0, maxItems);
  if (selected.length === 0) {
    return 'No recent Screenpipe context was found for this query.';
  }

  const lines = selected.map((item, index) => {
    const when = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'unknown time';
    const source = [item.appName, item.windowName].filter(Boolean).join(' / ') || 'unknown source';
    const text = item.text ? item.text.replace(/\s+/g, ' ').trim().slice(0, 280) : '(no text)';
    return `${index + 1}. [${item.type.toUpperCase()}] ${when} | ${source} | ${text}`;
  });

  return lines.join('\n');
};

const summarizeDigest = (items) => {
  const byType = {};
  const byApp = {};

  for (const item of items) {
    byType[item.type] = (byType[item.type] ?? 0) + 1;
    const appKey = item.appName || 'unknown';
    byApp[appKey] = (byApp[appKey] ?? 0) + 1;
  }

  const topTypes = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key, count]) => `${key}:${count}`)
    .join(', ');

  const topApps = Object.entries(byApp)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => `${key}:${count}`)
    .join(', ');

  return {
    total: items.length,
    byType,
    byApp,
    summary: `Captured ${items.length} items. Top types: ${topTypes || 'none'}. Top apps: ${topApps || 'none'}.`,
  };
};

export const resolveScreenpipeConfig = (settings = {}) => {
  const enabledFromEnv = normalizeBoolean(process.env.KRONOSCHAMBER_SCREENPIPE_ENABLED, undefined);
  const enabled = enabledFromEnv ?? normalizeBoolean(settings.screenpipeEnabled, true);

  return {
    enabled,
    baseUrl: normalizeBaseUrl(process.env.KRONOSCHAMBER_SCREENPIPE_BASE_URL || settings.screenpipeBaseUrl),
    autoContext: normalizeBoolean(settings.screenpipeAutoContext, true),
    timeoutMs: clampInteger(process.env.KRONOSCHAMBER_SCREENPIPE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1000, 30000),
  };
};

const requestScreenpipe = async (config, pathName, query = {}, fetchImpl = fetch) => {
  if (!config.enabled) {
    throw new ScreenpipeError('DISABLED', 'Screenpipe integration is disabled');
  }

  const endpoint = new URL(pathName, `${config.baseUrl.replace(/\/+$/, '')}/`);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    endpoint.searchParams.set(key, String(value));
  }

  try {
    const response = await fetchImpl(endpoint.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(config.timeoutMs),
    });

    const text = await response.text();
    const payload = text.length > 0 ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new ScreenpipeError('UPSTREAM_ERROR', `Screenpipe request failed with ${response.status}`, {
        statusCode: response.status,
        details: payload,
      });
    }

    return payload;
  } catch (error) {
    if (error instanceof ScreenpipeError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new ScreenpipeError('TIMEOUT', 'Screenpipe request timed out', { cause: error });
    }
    throw new ScreenpipeError('UNREACHABLE', 'Unable to reach Screenpipe service', { cause: error });
  }
};

export const getScreenpipeStatus = async (settings = {}, fetchImpl = fetch) => {
  const config = resolveScreenpipeConfig(settings);

  if (!config.enabled) {
    return {
      enabled: false,
      healthy: false,
      baseUrl: config.baseUrl,
      autoContext: config.autoContext,
      status: 'disabled',
      details: null,
    };
  }

  const startedAt = Date.now();
  try {
    const health = await requestScreenpipe(config, '/health', {}, fetchImpl);
    return {
      enabled: true,
      healthy: true,
      baseUrl: config.baseUrl,
      autoContext: config.autoContext,
      status: typeof health?.status === 'string' ? health.status : 'healthy',
      latencyMs: Date.now() - startedAt,
      details: health,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Screenpipe is unavailable';
    return {
      enabled: true,
      healthy: false,
      baseUrl: config.baseUrl,
      autoContext: config.autoContext,
      status: 'offline',
      latencyMs: Date.now() - startedAt,
      error: message,
    };
  }
};

export const searchScreenpipe = async (settings = {}, payload = {}, fetchImpl = fetch) => {
  const config = resolveScreenpipeConfig(settings);
  const query = normalizeSearchQuery(payload);
  const raw = await requestScreenpipe(config, '/search', query, fetchImpl);
  const normalized = normalizeSearchResponse(raw);
  return {
    ...normalized,
    query,
    runtimeTarget: config.baseUrl,
  };
};

export const buildScreenpipeContext = async (settings = {}, payload = {}, fetchImpl = fetch) => {
  const windowMinutes = clampInteger(payload.windowMinutes ?? payload.minutes, 90, 1, 7 * 24 * 60);
  const now = new Date();
  const start = new Date(now.getTime() - windowMinutes * 60 * 1000);

  const search = await searchScreenpipe(
    settings,
    {
      ...payload,
      startTime: payload.startTime ?? start.toISOString(),
      endTime: payload.endTime ?? now.toISOString(),
      limit: payload.limit ?? 16,
    },
    fetchImpl,
  );

  return {
    ...search,
    windowMinutes,
    context: formatContextText(search.items, { maxItems: payload.maxItems ?? 12 }),
  };
};

export const buildScreenpipeDigest = async (settings = {}, payload = {}, fetchImpl = fetch) => {
  const context = await buildScreenpipeContext(settings, {
    ...payload,
    limit: payload.limit ?? 40,
    maxItems: payload.maxItems ?? 15,
  }, fetchImpl);

  const digest = summarizeDigest(context.items);

  return {
    ...context,
    digest,
  };
};

export const __screenpipeTestUtils = {
  normalizeSearchQuery,
  normalizeSearchResponse,
  formatContextText,
  summarizeDigest,
  normalizeBaseUrl,
};

export { ScreenpipeError };
