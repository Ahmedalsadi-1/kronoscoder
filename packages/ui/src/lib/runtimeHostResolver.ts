import { desktopHostProbe, normalizeHostUrl, type DesktopHost, type HostProbeResult } from '@/lib/desktopHosts';

export type RuntimeHost = Pick<DesktopHost, 'id' | 'label' | 'url'>;

export type RuntimeHostProbe = (host: RuntimeHost) => Promise<HostProbeResult>;

const DEFAULT_LOCAL_ID = 'local';

const isReachable = (status: HostProbeResult['status']): boolean => status === 'ok' || status === 'auth';

export const orderRuntimeHosts = (
  hosts: RuntimeHost[],
  defaultHostId?: string | null
): RuntimeHost[] => {
  if (hosts.length <= 1) {
    return hosts;
  }

  const normalizedDefaultId = typeof defaultHostId === 'string' ? defaultHostId.trim() : '';
  if (!normalizedDefaultId) {
    return hosts;
  }

  const idx = hosts.findIndex((host) => host.id === normalizedDefaultId);
  if (idx <= 0) {
    return hosts;
  }

  return [hosts[idx], ...hosts.slice(0, idx), ...hosts.slice(idx + 1)];
};

const defaultProbe: RuntimeHostProbe = async (host) => {
  const normalized = normalizeHostUrl(host.url);
  if (!normalized) {
    return { status: 'unreachable', latencyMs: 0 };
  }
  return desktopHostProbe(normalized);
};

/**
 * Resolve the first reachable configured host, otherwise fall back to local.
 */
export const resolveBestRuntimeHost = async (
  configuredHosts: RuntimeHost[],
  probe: RuntimeHostProbe = defaultProbe
): Promise<RuntimeHost | 'local'> => {
  for (const host of configuredHosts) {
    const normalizedUrl = normalizeHostUrl(host.url);
    if (!normalizedUrl) {
      continue;
    }

    const result = await probe({ ...host, url: normalizedUrl });
    if (isReachable(result.status)) {
      return { ...host, url: normalizedUrl };
    }
  }

  return DEFAULT_LOCAL_ID;
};
