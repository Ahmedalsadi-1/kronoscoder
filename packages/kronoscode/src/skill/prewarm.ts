import { Instance } from '@/project/instance';
import { Skill } from './skill';
import { SkillSuggestion } from './suggestion';

export namespace SkillPrewarm {
  const PREWARM_TTL_MS = 10 * 60 * 1000;
  const MAX_CACHE_ENTRIES = 64;

  type CacheEntry = {
    expiresAt: number;
    suggested: string[];
  };

  const state = Instance.state(() => {
    return {
      cacheByKey: new Map<string, CacheEntry>(),
    };
  });

  const normalizePath = (value?: string | null): string => {
    const raw = typeof value === 'string' && value.trim().length > 0 ? value.trim() : Instance.directory;
    const normalized = raw.replace(/\\/g, '/');
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

  const buildCacheKey = (cwd: string, agent: string | null): string => `${cwd}::${agent ?? ''}`;

  const pruneExpired = (now: number) => {
    const cache = state().cacheByKey;
    for (const [key, entry] of cache.entries()) {
      if (entry.expiresAt <= now) {
        cache.delete(key);
      }
    }
  };

  const pruneOverflow = () => {
    const cache = state().cacheByKey;
    while (cache.size > MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (!oldest) {
        break;
      }
      cache.delete(oldest);
    }
  };

  const warmSuggestedSkills = async (names: string[]) => {
    for (const name of names) {
      await Skill.get(name);
    }
  };

  export const prewarm = async (input?: { cwd?: string | null; agent?: string | null }) => {
    const cwd = normalizePath(input?.cwd);
    const agent = normalizeAgent(input?.agent);
    const key = buildCacheKey(cwd, agent);
    const now = Date.now();

    pruneExpired(now);

    const cache = state().cacheByKey;
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      return {
        cached: true,
        cwd,
        agent,
        suggested: cached.suggested,
      };
    }

    const suggestedSkills = await SkillSuggestion.suggest();
    const suggestedNames = suggestedSkills.map((skill) => skill.name);

    await warmSuggestedSkills(suggestedNames);

    cache.set(key, {
      expiresAt: now + PREWARM_TTL_MS,
      suggested: suggestedNames,
    });
    pruneOverflow();

    return {
      cached: false,
      cwd,
      agent,
      suggested: suggestedNames,
    };
  };
}
