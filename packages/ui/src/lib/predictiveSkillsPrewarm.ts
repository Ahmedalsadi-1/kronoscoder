type PrewarmReason = 'prompt_send' | 'agent_switch' | 'manual';

export type PredictiveSkillsPrewarmInput = {
  cwd?: string | null;
  agent?: string | null;
  reason?: PrewarmReason;
};

const PREWARM_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 64;

const prewarmExpiryByKey = new Map<string, number>();
const inFlightByKey = new Map<string, Promise<void>>();

const normalizePath = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.replace(/\\/g, '/');
  if (normalized === '/') {
    return normalized;
  }
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
};

const normalizeAgent = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildKey = (cwd: string | null, agent: string | null): string => `${cwd ?? ''}::${agent ?? ''}`;

const pruneExpired = (now: number) => {
  for (const [key, expiresAt] of prewarmExpiryByKey.entries()) {
    if (expiresAt <= now) {
      prewarmExpiryByKey.delete(key);
    }
  }
};

const pruneOverflow = () => {
  while (prewarmExpiryByKey.size > MAX_CACHE_ENTRIES) {
    const oldest = prewarmExpiryByKey.keys().next().value;
    if (!oldest) {
      break;
    }
    prewarmExpiryByKey.delete(oldest);
  }
};

const shouldSkipDueToCache = (key: string, now: number): boolean => {
  const expiresAt = prewarmExpiryByKey.get(key);
  return typeof expiresAt === 'number' && expiresAt > now;
};

const requestPrewarm = async (cwd: string, agent: string | null, reason: PrewarmReason) => {
  const params = new URLSearchParams();
  params.set('directory', cwd);

  const response = await fetch(`/api/skill/prewarm?${params.toString()}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      cwd,
      agent: agent ?? undefined,
      reason,
    }),
  });

  if (!response.ok) {
    throw new Error(`Skill prewarm failed (${response.status})`);
  }
};

export const prewarmPredictiveSkills = (input: PredictiveSkillsPrewarmInput): void => {
  const cwd = normalizePath(input.cwd);
  if (!cwd) {
    return;
  }

  const agent = normalizeAgent(input.agent);
  const reason = input.reason ?? 'manual';
  const now = Date.now();

  pruneExpired(now);
  const key = buildKey(cwd, agent);
  if (shouldSkipDueToCache(key, now)) {
    return;
  }

  const existing = inFlightByKey.get(key);
  if (existing) {
    return;
  }

  const task = requestPrewarm(cwd, agent, reason)
    .then(() => {
      prewarmExpiryByKey.set(key, Date.now() + PREWARM_TTL_MS);
      pruneOverflow();
    })
    .catch(() => {
      // Intentionally ignored: prewarm is best-effort and non-blocking.
    })
    .finally(() => {
      inFlightByKey.delete(key);
    });

  inFlightByKey.set(key, task);
};

export const __predictiveSkillsPrewarmTestUtils = {
  reset() {
    prewarmExpiryByKey.clear();
    inFlightByKey.clear();
  },
  cacheSize() {
    return prewarmExpiryByKey.size;
  },
};
