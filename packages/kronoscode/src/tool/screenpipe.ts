import z from 'zod'
import { Tool } from './tool'
import { abortAfterAny } from '../util/abort'

const DEFAULT_BASE_URL = 'http://127.0.0.1:3030'
const DEFAULT_TIMEOUT_MS = 5000
const HEALTH_CACHE_TTL_MS = 15_000

type ScreenpipeItem = {
  id: string
  type: string
  timestamp: string | null
  appName: string | null
  windowName: string | null
  browserUrl: string | null
  text: string
}

type SearchResult = {
  items: ScreenpipeItem[]
  total: number
  limit: number
  offset: number
}

let healthCache: {
  expiresAt: number
  healthy: boolean
  error?: string
} = {
  expiresAt: 0,
  healthy: false,
}

const resolveBaseUrl = () => {
  const env = typeof process.env.KRONOSCHAMBER_SCREENPIPE_BASE_URL === 'string'
    ? process.env.KRONOSCHAMBER_SCREENPIPE_BASE_URL.trim()
    : ''
  return env.length > 0 ? env : DEFAULT_BASE_URL
}

const resolveTimeoutMs = () => {
  const raw = Number.parseInt(process.env.KRONOSCHAMBER_SCREENPIPE_TIMEOUT_MS || '', 10)
  if (!Number.isFinite(raw)) return DEFAULT_TIMEOUT_MS
  return Math.max(1000, Math.min(30_000, raw))
}

const normalizeContentType = (value: unknown): string => {
  const allowed = new Set(['all', 'ocr', 'audio', 'ui', 'input'])
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (allowed.has(normalized)) return normalized
  return 'all'
}

const mapItem = (entry: any, index: number): ScreenpipeItem => {
  const typeRaw = typeof entry?.type === 'string' ? entry.type : 'unknown'
  const type = typeRaw.toLowerCase()
  const content = entry?.content && typeof entry.content === 'object' ? entry.content : {}

  const text = typeof content.text === 'string'
    ? content.text
    : typeof content.transcription === 'string'
      ? content.transcription
      : typeof content.text_content === 'string'
        ? content.text_content
        : ''

  const id =
    content.frame_id ??
    content.chunk_id ??
    content.id ??
    `${type}-${index}`

  return {
    id: String(id),
    type,
    timestamp: typeof content.timestamp === 'string' ? content.timestamp : null,
    appName: typeof content.app_name === 'string' ? content.app_name : null,
    windowName: typeof content.window_name === 'string' ? content.window_name : null,
    browserUrl: typeof content.browser_url === 'string' ? content.browser_url : null,
    text,
  }
}

const formatItems = (items: ScreenpipeItem[], max = 12) => {
  if (items.length === 0) {
    return 'No matching Screenpipe items were found.'
  }

  return items.slice(0, max).map((item, index) => {
    const when = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'unknown time'
    const source = [item.appName, item.windowName].filter(Boolean).join(' / ') || 'unknown source'
    const text = item.text.replace(/\s+/g, ' ').trim().slice(0, 260) || '(no text)'
    return `${index + 1}. [${item.type.toUpperCase()}] ${when} | ${source} | ${text}`
  }).join('\n')
}

const toIso = (value?: string): string | null => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

const buildSearchParams = (input: {
  q?: string
  contentType?: string
  limit?: number
  offset?: number
  startTime?: string
  endTime?: string
  appName?: string
  windowName?: string
  browserUrl?: string
}) => {
  const params = new URLSearchParams()

  const q = typeof input.q === 'string' ? input.q.trim() : ''
  if (q.length > 0) params.set('q', q)

  const contentType = normalizeContentType(input.contentType)
  params.set('content_type', contentType)

  const limit = Number.isFinite(input.limit) ? Math.max(1, Math.min(200, Math.round(Number(input.limit)))) : 20
  const offset = Number.isFinite(input.offset) ? Math.max(0, Math.round(Number(input.offset))) : 0
  params.set('limit', String(limit))
  params.set('offset', String(offset))

  const start = toIso(input.startTime)
  const end = toIso(input.endTime)
  if (start) params.set('start_time', start)
  if (end) params.set('end_time', end)

  const appName = typeof input.appName === 'string' ? input.appName.trim() : ''
  const windowName = typeof input.windowName === 'string' ? input.windowName.trim() : ''
  const browserUrl = typeof input.browserUrl === 'string' ? input.browserUrl.trim() : ''

  if (appName) params.set('app_name', appName)
  if (windowName) params.set('window_name', windowName)
  if (browserUrl) params.set('browser_url', browserUrl)

  return params
}

const queryScreenpipe = async (input: {
  q?: string
  contentType?: string
  limit?: number
  offset?: number
  startTime?: string
  endTime?: string
  appName?: string
  windowName?: string
  browserUrl?: string
}, abort: AbortSignal): Promise<SearchResult> => {
  const baseUrl = resolveBaseUrl().replace(/\/+$/, '')
  const timeoutMs = resolveTimeoutMs()
  const params = buildSearchParams(input)

  const { signal, clearTimeout } = abortAfterAny(timeoutMs, abort)
  try {
    const response = await fetch(`${baseUrl}/search?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    })

    if (!response.ok) {
      const details = await response.text().catch(() => '')
      throw new Error(`Screenpipe search failed (${response.status})${details ? `: ${details}` : ''}`)
    }

    const payload = await response.json().catch(() => ({}))
    const data = Array.isArray((payload as any)?.data) ? (payload as any).data : []
    const pagination = (payload as any)?.pagination && typeof (payload as any).pagination === 'object'
      ? (payload as any).pagination
      : {}

    const limit = Number.isFinite(pagination.limit) ? Number(pagination.limit) : data.length
    const offset = Number.isFinite(pagination.offset) ? Number(pagination.offset) : 0
    const total = Number.isFinite(pagination.total) ? Number(pagination.total) : data.length

    return {
      items: data.map((entry: any, index: number) => mapItem(entry, index)),
      limit,
      offset,
      total,
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error('Screenpipe request timed out')
    }
    throw error
  } finally {
    clearTimeout()
  }
}

const digestFromItems = (items: ScreenpipeItem[]) => {
  const byType: Record<string, number> = {}
  const byApp: Record<string, number> = {}

  for (const item of items) {
    byType[item.type] = (byType[item.type] ?? 0) + 1
    const app = item.appName || 'unknown'
    byApp[app] = (byApp[app] ?? 0) + 1
  }

  const topTypes = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => `${name}:${count}`)
    .join(', ')

  const topApps = Object.entries(byApp)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => `${name}:${count}`)
    .join(', ')

  return `Captured ${items.length} items. Top types: ${topTypes || 'none'}. Top apps: ${topApps || 'none'}.`
}

export const isScreenpipeAvailable = async (forceRefresh = false): Promise<boolean> => {
  const now = Date.now()
  if (!forceRefresh && healthCache.expiresAt > now) {
    return healthCache.healthy
  }

  const timeoutMs = resolveTimeoutMs()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${resolveBaseUrl().replace(/\/+$/, '')}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    const healthy = response.ok
    healthCache = {
      healthy,
      expiresAt: now + HEALTH_CACHE_TTL_MS,
    }
    return healthy
  } catch (error) {
    healthCache = {
      healthy: false,
      error: error instanceof Error ? error.message : 'unknown error',
      expiresAt: now + HEALTH_CACHE_TTL_MS,
    }
    return false
  } finally {
    clearTimeout(timer)
  }
}

const availabilityMessage = () =>
  `Screenpipe is unavailable at ${resolveBaseUrl()}. Start Screenpipe locally and retry.`

export const ScreenpipeSearchTool = Tool.define('screenpipe_search', {
  description: 'Search local Screenpipe memory (OCR/audio/UI history).',
  parameters: z.object({
    q: z.string().optional().describe('Search text query'),
    contentType: z.string().optional().describe('all|ocr|audio|ui|input'),
    limit: z.number().optional().describe('Maximum results (default 20)'),
    offset: z.number().optional().describe('Result offset'),
    startTime: z.string().optional().describe('ISO start timestamp'),
    endTime: z.string().optional().describe('ISO end timestamp'),
    appName: z.string().optional().describe('Filter by app name'),
    windowName: z.string().optional().describe('Filter by window name'),
    browserUrl: z.string().optional().describe('Filter by browser URL'),
  }),
  async execute(params, ctx) {
    if (!(await isScreenpipeAvailable())) {
      return {
        title: 'Screenpipe unavailable',
        output: availabilityMessage(),
        metadata: { available: false, runtimeTarget: resolveBaseUrl(), total: 0, limit: 0, offset: 0 },
      }
    }

    await ctx.ask({
      permission: 'webfetch',
      patterns: [resolveBaseUrl()],
      always: ['*'],
      metadata: { tool: 'screenpipe_search', ...params },
    })

    const result = await queryScreenpipe(params, ctx.abort)

    return {
      title: 'Screenpipe search',
      output: formatItems(result.items, Math.min(result.limit, 20)),
      metadata: {
        available: true,
        runtimeTarget: resolveBaseUrl(),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    }
  },
})

export const ScreenpipeRecallTool = Tool.define('screenpipe_recall', {
  description: 'Recall recent Screenpipe activity over a time window.',
  parameters: z.object({
    q: z.string().optional().describe('Optional search text'),
    windowMinutes: z.number().optional().describe('Lookback window in minutes (default 90)'),
    limit: z.number().optional().describe('Maximum results (default 20)'),
  }),
  async execute(params, ctx) {
    if (!(await isScreenpipeAvailable())) {
      const minutes = Number.isFinite(params.windowMinutes) ? Math.max(1, Math.min(7 * 24 * 60, Math.round(params.windowMinutes!))) : 90
      return {
        title: 'Screenpipe unavailable',
        output: availabilityMessage(),
        metadata: { available: false, runtimeTarget: resolveBaseUrl(), total: 0, windowMinutes: minutes },
      }
    }

    const minutes = Number.isFinite(params.windowMinutes) ? Math.max(1, Math.min(7 * 24 * 60, Math.round(params.windowMinutes!))) : 90
    const end = new Date()
    const start = new Date(end.getTime() - minutes * 60 * 1000)

    const result = await queryScreenpipe(
      {
        q: params.q,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        limit: params.limit,
      },
      ctx.abort,
    )

    return {
      title: 'Screenpipe recall',
      output: formatItems(result.items, Math.min(result.limit, 20)),
      metadata: {
        available: true,
        runtimeTarget: resolveBaseUrl(),
        total: result.total,
        windowMinutes: minutes,
      },
    }
  },
})

export const ScreenpipeContextTool = Tool.define('screenpipe_context', {
  description: 'Build a context block from recent Screenpipe memory.',
  parameters: z.object({
    q: z.string().optional().describe('Optional search text'),
    windowMinutes: z.number().optional().describe('Lookback window in minutes (default 90)'),
    limit: z.number().optional().describe('Maximum items (default 16)'),
    contentType: z.string().optional().describe('all|ocr|audio|ui|input'),
  }),
  async execute(params, ctx) {
    if (!(await isScreenpipeAvailable())) {
      const minutes = Number.isFinite(params.windowMinutes) ? Math.max(1, Math.min(7 * 24 * 60, Math.round(params.windowMinutes!))) : 90
      return {
        title: 'Screenpipe unavailable',
        output: availabilityMessage(),
        metadata: { available: false, runtimeTarget: resolveBaseUrl(), total: 0, windowMinutes: minutes },
      }
    }

    const minutes = Number.isFinite(params.windowMinutes) ? Math.max(1, Math.min(7 * 24 * 60, Math.round(params.windowMinutes!))) : 90
    const end = new Date()
    const start = new Date(end.getTime() - minutes * 60 * 1000)

    const result = await queryScreenpipe(
      {
        q: params.q,
        contentType: params.contentType,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        limit: params.limit ?? 16,
      },
      ctx.abort,
    )

    const contextText = formatItems(result.items, Math.min(result.limit, 16))

    return {
      title: 'Screenpipe context',
      output: contextText,
      metadata: {
        available: true,
        runtimeTarget: resolveBaseUrl(),
        total: result.total,
        windowMinutes: minutes,
      },
    }
  },
})

export const ScreenpipeDigestTool = Tool.define('screenpipe_digest', {
  description: 'Generate a short digest from recent Screenpipe memory.',
  parameters: z.object({
    q: z.string().optional().describe('Optional search text'),
    windowMinutes: z.number().optional().describe('Lookback window in minutes (default 180)'),
    limit: z.number().optional().describe('Maximum items considered (default 40)'),
    contentType: z.string().optional().describe('all|ocr|audio|ui|input'),
  }),
  async execute(params, ctx) {
    if (!(await isScreenpipeAvailable())) {
      const minutes = Number.isFinite(params.windowMinutes) ? Math.max(1, Math.min(7 * 24 * 60, Math.round(params.windowMinutes!))) : 180
      return {
        title: 'Screenpipe unavailable',
        output: availabilityMessage(),
        metadata: { available: false, runtimeTarget: resolveBaseUrl(), total: 0, windowMinutes: minutes },
      }
    }

    const minutes = Number.isFinite(params.windowMinutes) ? Math.max(1, Math.min(7 * 24 * 60, Math.round(params.windowMinutes!))) : 180
    const end = new Date()
    const start = new Date(end.getTime() - minutes * 60 * 1000)

    const result = await queryScreenpipe(
      {
        q: params.q,
        contentType: params.contentType,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        limit: params.limit ?? 40,
      },
      ctx.abort,
    )

    const digest = digestFromItems(result.items)
    const highlights = formatItems(result.items, 8)

    return {
      title: 'Screenpipe digest',
      output: `${digest}\n\nHighlights:\n${highlights}`,
      metadata: {
        available: true,
        runtimeTarget: resolveBaseUrl(),
        total: result.total,
        windowMinutes: minutes,
      },
    }
  },
})
