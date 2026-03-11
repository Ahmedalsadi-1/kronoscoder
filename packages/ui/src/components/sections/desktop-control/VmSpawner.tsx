import React from 'react';
import {
  RiArrowRightUpLine,
  RiCloudLine,
  RiComputerLine,
  RiFlashlightLine,
  RiGlobalLine,
  RiLoader4Line,
  RiLock2Line,
  RiRefreshLine,
  RiShieldCheckLine,
  RiTerminalLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui';
import { cn } from '@/lib/utils';

type SessionType = 'browser' | 'terminal' | 'desktop';
type ProviderID = 'e2b' | 'self-hosted';

type DesktopSession = {
  id: string;
  userId: string;
  organizationId: string;
  sessionType: SessionType;
  sessionState: string;
  status: string;
  sandboxId: string | null;
  sandboxProvider: ProviderID | null;
  config: {
    timeout_minutes?: number;
    memory_limit_mb?: number;
    cpu_limit?: number;
    allowed_domains?: string[];
  } | null;
  metadata: {
    session_name?: string;
    description?: string;
    tags?: string[];
  } | null;
  startedAt: number | null;
  pausedAt: number | null;
  stoppedAt: number | null;
  lastActivityAt: number | null;
  lastHeartbeatAt: number | null;
  controlMode: 'agent' | 'user' | null;
  takeoverUserId: string | null;
  takeoverStartedAt: number | null;
  takeoverLockExpiresAt: number | null;
  jobId: string | null;
  timeCreated: number;
  timeUpdated: number;
};

type DesktopProviderSummary = {
  id: ProviderID;
  label: string;
  enabled: boolean;
  implemented: boolean;
  available: boolean;
  default: boolean;
  reason: string | null;
  supportedSessionTypes: SessionType[];
};

type QuotaSummary = {
  limits: Record<SessionType, number>;
  usage: Record<SessionType, number>;
};

type DesktopSessionsResponse = {
  sessions: DesktopSession[];
  providers: DesktopProviderSummary[];
  quotas: QuotaSummary;
};

type FormState = {
  sessionType: SessionType;
  provider: ProviderID | null;
  sessionName: string;
  timeoutMinutes: string;
  memoryMb: string;
  cpuLimit: string;
  allowedDomains: string;
};

interface VmSpawnerProps {
  className?: string;
}

const DEFAULT_FORM: FormState = {
  sessionType: 'desktop',
  provider: null,
  sessionName: '',
  timeoutMinutes: '45',
  memoryMb: '4096',
  cpuLimit: '2',
  allowedDomains: '',
};

const SESSION_TYPE_COPY: Record<SessionType, { label: string; description: string }> = {
  desktop: {
    label: 'Desktop',
    description: 'Full remote desktop session for interactive control and streaming.',
  },
  browser: {
    label: 'Browser',
    description: 'Browser-focused sandbox with tighter navigation guardrails.',
  },
  terminal: {
    label: 'Terminal',
    description: 'Terminal-only runtime for commands, scripts, and isolated execution.',
  },
};

const sessionTypeIcon = (sessionType: SessionType) => {
  if (sessionType === 'browser') return RiGlobalLine;
  if (sessionType === 'terminal') return RiTerminalLine;
  return RiComputerLine;
};

const formatRelativeTime = (timestamp: number | null | undefined): string => {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return 'Never';
  }

  const deltaMs = Math.max(0, Date.now() - timestamp);
  if (deltaMs < 60_000) {
    return 'Just now';
  }

  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const formatExactTime = (timestamp: number | null | undefined): string => {
  if (!timestamp || !Number.isFinite(timestamp)) {
    return 'Unknown';
  }
  return new Date(timestamp).toLocaleString();
};

const statusBadgeClassName = (sessionState: string) => {
  if (sessionState === 'active' || sessionState === 'controlled_by_agent' || sessionState === 'controlled_by_user') {
    return 'border-status-success/30 bg-status-success/10 text-status-success';
  }
  if (sessionState === 'provisioning' || sessionState === 'takeover_pending') {
    return 'border-[var(--status-info-border)] bg-[var(--status-info-background)] text-[var(--status-info)]';
  }
  if (sessionState === 'failed' || sessionState === 'expired') {
    return 'border-status-error/30 bg-status-error/10 text-status-error';
  }
  return 'border-border/70 bg-muted/40 text-muted-foreground';
};

const statusLabel = (sessionState: string, status: string): string => {
  if (sessionState === 'controlled_by_user') return 'User takeover';
  if (sessionState === 'controlled_by_agent') return 'Agent control';
  if (sessionState === 'provisioning') return 'Provisioning';
  if (sessionState === 'takeover_pending') return 'Takeover pending';
  if (sessionState === 'expiring') return 'Expiring';
  if (sessionState === 'expired') return 'Expired';
  if (sessionState === 'failed') return 'Failed';
  if (sessionState === 'paused') return 'Paused';
  if (sessionState === 'active') return 'Active';
  return status || 'Unknown';
};

const buildCreatePayload = (form: FormState) => {
  const timeoutMinutes = Number.parseInt(form.timeoutMinutes, 10);
  const memoryMb = Number.parseInt(form.memoryMb, 10);
  const cpuLimit = Number.parseInt(form.cpuLimit, 10);
  const allowedDomains = form.allowedDomains
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return {
    sessionType: form.sessionType,
    provider: form.provider ?? undefined,
    config: {
      ...(Number.isFinite(timeoutMinutes) && timeoutMinutes > 0 ? { timeout_minutes: timeoutMinutes } : {}),
      ...(Number.isFinite(memoryMb) && memoryMb > 0 ? { memory_limit_mb: memoryMb } : {}),
      ...(Number.isFinite(cpuLimit) && cpuLimit > 0 ? { cpu_limit: cpuLimit } : {}),
      ...(allowedDomains.length > 0 ? { allowed_domains: allowedDomains } : {}),
    },
    metadata: {
      ...(form.sessionName.trim().length > 0 ? { session_name: form.sessionName.trim() } : {}),
    },
  };
};

const fetchDesktopSessions = async (): Promise<DesktopSessionsResponse> => {
  const response = await fetch('/api/marketplace/desktop/sessions', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const payload = await response.json().catch(() => null) as (DesktopSessionsResponse & { error?: string }) | null;
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to load desktop sessions');
  }
  if (!payload) {
    throw new Error('Desktop session response was empty');
  }
  return payload;
};

const createDesktopSession = async (form: FormState) => {
  const response = await fetch('/api/marketplace/desktop/sessions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(buildCreatePayload(form)),
  });
  const payload = await response.json().catch(() => null) as { error?: string; sessionId?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to create desktop session');
  }
  return payload;
};

const requestTakeover = async (sessionID: string) => {
  const response = await fetch(`/api/marketplace/desktop/sessions/${encodeURIComponent(sessionID)}/takeover`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  const payload = await response.json().catch(() => null) as { error?: string; lockExpiresAt?: number } | null;
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to request takeover');
  }
  return payload;
};

const releaseTakeover = async (sessionID: string) => {
  const response = await fetch(`/api/marketplace/desktop/sessions/${encodeURIComponent(sessionID)}/release`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.error || 'Failed to release takeover');
  }
  return payload;
};

export function VmSpawner({ className }: VmSpawnerProps) {
  const [sessions, setSessions] = React.useState<DesktopSession[]>([]);
  const [providers, setProviders] = React.useState<DesktopProviderSummary[]>([]);
  const [quotas, setQuotas] = React.useState<QuotaSummary>({
    limits: { browser: 10, terminal: 5, desktop: 2 },
    usage: { browser: 0, terminal: 0, desktop: 0 },
  });
  const [form, setForm] = React.useState<FormState>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [busySessionID, setBusySessionID] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    setError(null);
    try {
      const nextState = await fetchDesktopSessions();
      setSessions(nextState.sessions);
      setProviders(nextState.providers);
      setQuotas(nextState.quotas);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sandbox sessions');
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  React.useEffect(() => {
    const hasLiveSessions = sessions.some((session) => (
      session.sessionState === 'provisioning'
      || session.sessionState === 'active'
      || session.sessionState === 'controlled_by_agent'
      || session.sessionState === 'controlled_by_user'
      || session.sessionState === 'takeover_pending'
    ));

    if (!hasLiveSessions) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void reload(true);
    }, 5_000);

    return () => window.clearInterval(interval);
  }, [reload, sessions]);

  const availableProviders = React.useMemo(
    () => providers.filter((provider) => provider.available),
    [providers],
  );

  const activeProvider = React.useMemo(
    () => providers.find((provider) => provider.id === form.provider) ?? null,
    [form.provider, providers],
  );

  React.useEffect(() => {
    if (activeProvider?.available) {
      return;
    }

    const nextProvider = availableProviders.find((provider) => provider.default) ?? availableProviders[0] ?? null;
    if (!nextProvider) {
      return;
    }

    setForm((prev) => (
      prev.provider === nextProvider.id
        ? prev
        : { ...prev, provider: nextProvider.id }
    ));
  }, [activeProvider?.available, availableProviders]);

  const handleFormChange = React.useCallback((key: keyof FormState, value: FormState[keyof FormState]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleCreateSession = React.useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await createDesktopSession(form);
      toast.success('Sandbox session queued for provisioning.');
      setForm((prev) => ({
        ...DEFAULT_FORM,
        provider: prev.provider,
        sessionType: prev.sessionType,
      }));
      await reload(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create sandbox session';
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, reload]);

  const handleTakeover = React.useCallback(async (sessionID: string) => {
    setBusySessionID(sessionID);
    setError(null);
    try {
      const result = await requestTakeover(sessionID);
      toast.success(
        result?.lockExpiresAt
          ? `Manual control granted until ${formatExactTime(result.lockExpiresAt)}.`
          : 'Manual control granted.',
      );
      await reload(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to request takeover';
      setError(message);
      toast.error(message);
    } finally {
      setBusySessionID(null);
    }
  }, [reload]);

  const handleRelease = React.useCallback(async (sessionID: string) => {
    setBusySessionID(sessionID);
    setError(null);
    try {
      await releaseTakeover(sessionID);
      toast.success('Returned session control to the agent.');
      await reload(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to release takeover';
      setError(message);
      toast.error(message);
    } finally {
      setBusySessionID(null);
    }
  }, [reload]);

  const canCreate = Boolean(activeProvider?.available) && !isSubmitting;

  return (
    <div className={cn('space-y-6', className)}>
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/75 p-5 shadow-sm backdrop-blur">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{ background: 'radial-gradient(120% 150% at 100% 0%, var(--status-info-background) 0%, transparent 56%)' }}
        />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-background/70">
                <RiShieldCheckLine className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Sandbox Sessions</h3>
                <p className="text-sm text-muted-foreground">
                  Provision real browser, terminal, and desktop sandboxes from the broker instead of local mock state.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(Object.keys(quotas.limits) as SessionType[]).map((sessionType) => (
                <Badge key={sessionType} variant="secondary" className="gap-1 rounded-full px-3 py-1 text-[11px]">
                  {SESSION_TYPE_COPY[sessionType].label} {quotas.usage[sessionType]}/{quotas.limits[sessionType]}
                </Badge>
              ))}
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" className="gap-2 self-start" onClick={() => void reload()} disabled={isLoading}>
            {isLoading ? <RiLoader4Line className="h-4 w-4 animate-spin" /> : <RiRefreshLine className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-border/60 bg-card/70 p-5 backdrop-blur">
          <div className="mb-4">
            <h4 className="font-medium">Launch sandbox</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose the runtime surface, provider, and guardrails to apply when the broker provisions the session.
            </p>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            {(Object.keys(SESSION_TYPE_COPY) as SessionType[]).map((sessionType) => {
              const Icon = sessionTypeIcon(sessionType);
              const isActive = form.sessionType === sessionType;
              return (
                <button
                  key={sessionType}
                  type="button"
                  onClick={() => handleFormChange('sessionType', sessionType)}
                  className={cn(
                    'rounded-2xl border px-4 py-3 text-left transition-all',
                    isActive
                      ? 'border-primary/50 bg-primary/10 shadow-sm'
                      : 'border-border/60 bg-background/50 hover:border-primary/30 hover:bg-background/80',
                  )}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="font-medium">{SESSION_TYPE_COPY[sessionType].label}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{SESSION_TYPE_COPY[sessionType].description}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Session name</label>
              <Input
                value={form.sessionName}
                onChange={(event) => handleFormChange('sessionName', event.target.value)}
                placeholder="Design QA desktop"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Provider</label>
              <div className="flex min-h-10 items-center rounded-xl border border-border/60 bg-background/60 px-3 text-sm">
                {activeProvider ? activeProvider.label : 'No provider available'}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Timeout (minutes)</label>
              <Input
                inputMode="numeric"
                value={form.timeoutMinutes}
                onChange={(event) => handleFormChange('timeoutMinutes', event.target.value)}
                placeholder="45"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CPU limit</label>
              <Input
                inputMode="numeric"
                value={form.cpuLimit}
                onChange={(event) => handleFormChange('cpuLimit', event.target.value)}
                placeholder="2"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Memory (MB)</label>
              <Input
                inputMode="numeric"
                value={form.memoryMb}
                onChange={(event) => handleFormChange('memoryMb', event.target.value)}
                placeholder="4096"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Allowed domains</label>
              <Input
                value={form.allowedDomains}
                onChange={(event) => handleFormChange('allowedDomains', event.target.value)}
                placeholder={form.sessionType === 'terminal' ? 'Optional, stored for policy metadata' : 'example.com, docs.kronos.dev'}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/55 px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">
                {activeProvider?.available ? 'Provider ready' : 'Provider unavailable'}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {activeProvider?.reason || 'This provider can provision real sandbox sessions now.'}
              </p>
            </div>
            <Button type="button" className="gap-2" onClick={() => void handleCreateSession()} disabled={!canCreate}>
              {isSubmitting ? <RiLoader4Line className="h-4 w-4 animate-spin" /> : <RiFlashlightLine className="h-4 w-4" />}
              Launch
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/70 p-5 backdrop-blur">
          <div className="mb-4">
            <h4 className="font-medium">Provider and sandbox status</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              The UI now reflects real provider capability instead of inventing reachable VMs or URLs.
            </p>
          </div>
          <div className="space-y-3">
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => {
                  if (provider.available) {
                    handleFormChange('provider', provider.id);
                  }
                }}
                disabled={!provider.available}
                className={cn(
                  'w-full rounded-2xl border p-4 text-left transition-all',
                  form.provider === provider.id && provider.available
                    ? 'border-primary/50 bg-primary/10'
                    : 'border-border/60 bg-background/50',
                  provider.available ? 'hover:border-primary/30 hover:bg-background/80' : 'cursor-not-allowed opacity-80',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <RiCloudLine className="h-4 w-4 text-primary" />
                      <span className="font-medium">{provider.label}</span>
                      {provider.default ? (
                        <Badge variant="secondary" className="rounded-full text-[10px] uppercase tracking-wide">
                          Default
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {provider.reason || 'Provisioning is enabled and ready for real sessions.'}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'rounded-full',
                      provider.available
                        ? 'border-status-success/30 bg-status-success/10 text-status-success'
                        : 'border-border/70 text-muted-foreground',
                    )}
                  >
                    {provider.available ? 'Available' : provider.implemented ? 'Disabled' : 'Unavailable'}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span className="rounded-full border border-border/60 px-2 py-1">
                    Enabled: {provider.enabled ? 'yes' : 'no'}
                  </span>
                  <span className="rounded-full border border-border/60 px-2 py-1">
                    Implemented: {provider.implemented ? 'yes' : 'no'}
                  </span>
                  <span className="rounded-full border border-border/60 px-2 py-1">
                    Supports: {provider.supportedSessionTypes.join(', ')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/70 p-5 backdrop-blur">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h4 className="font-medium">Active sandbox sessions</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Real broker state, provider selection, heartbeat timing, and takeover control.
            </p>
          </div>
          <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px]">
            {sessions.length} sessions
          </Badge>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/35 px-6 py-8 text-center">
            <RiComputerLine className="mx-auto h-8 w-8 text-muted-foreground/70" />
            <p className="mt-3 text-sm text-muted-foreground">
              No sandbox sessions have been provisioned for this org yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => {
              const SessionIcon = sessionTypeIcon(session.sessionType);
              const isBusy = busySessionID === session.id;
              const canTakeover = session.sessionState === 'active' || session.sessionState === 'controlled_by_agent';
              const canRelease = session.sessionState === 'controlled_by_user';
              const sessionName = session.metadata?.session_name?.trim() || `${SESSION_TYPE_COPY[session.sessionType].label} session`;

              return (
                <div
                  key={session.id}
                  className="relative overflow-hidden rounded-2xl border border-border/60 bg-background/55 p-4"
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-60"
                    style={{ background: 'radial-gradient(120% 150% at 100% 0%, var(--surface-overlay) 0%, transparent 54%)' }}
                  />
                  <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card/80">
                          <SessionIcon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="truncate font-medium">{sessionName}</h5>
                            <Badge variant="outline" className={cn('rounded-full border text-[11px]', statusBadgeClassName(session.sessionState))}>
                              {statusLabel(session.sessionState, session.status)}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {SESSION_TYPE_COPY[session.sessionType].label} via {session.sandboxProvider || 'unknown provider'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded-full border border-border/60 px-2 py-1">
                          Sandbox {session.sandboxId || 'pending'}
                        </span>
                        <span className="rounded-full border border-border/60 px-2 py-1">
                          Control {session.controlMode || 'agent'}
                        </span>
                        <span className="rounded-full border border-border/60 px-2 py-1">
                          Updated {formatRelativeTime(session.timeUpdated)}
                        </span>
                        <span className="rounded-full border border-border/60 px-2 py-1">
                          Heartbeat {formatRelativeTime(session.lastHeartbeatAt)}
                        </span>
                        {session.jobId ? (
                          <span className="rounded-full border border-border/60 px-2 py-1">
                            Job {session.jobId}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Timeout</div>
                          <div className="mt-1 text-sm text-foreground">
                            {session.config?.timeout_minutes ? `${session.config.timeout_minutes} min` : 'Default'}
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Memory</div>
                          <div className="mt-1 text-sm text-foreground">
                            {session.config?.memory_limit_mb ? `${session.config.memory_limit_mb} MB` : 'Default'}
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">CPU</div>
                          <div className="mt-1 text-sm text-foreground">
                            {session.config?.cpu_limit ? `${session.config.cpu_limit} cores` : 'Default'}
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-2">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Allowed domains</div>
                          <div className="mt-1 truncate text-sm text-foreground" title={session.config?.allowed_domains?.join(', ') || 'Any'}>
                            {session.config?.allowed_domains?.length ? session.config.allowed_domains.join(', ') : 'Any'}
                          </div>
                        </div>
                      </div>

                      {session.takeoverLockExpiresAt ? (
                        <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-background)] px-3 py-2 text-xs text-[var(--status-info)]">
                          <RiLock2Line className="h-3.5 w-3.5" />
                          Manual control lock expires {formatExactTime(session.takeoverLockExpiresAt)}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {canTakeover ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => void handleTakeover(session.id)}
                          disabled={isBusy}
                        >
                          {isBusy ? <RiLoader4Line className="h-4 w-4 animate-spin" /> : <RiArrowRightUpLine className="h-4 w-4" />}
                          Take over
                        </Button>
                      ) : null}
                      {canRelease ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => void handleRelease(session.id)}
                          disabled={isBusy}
                        >
                          {isBusy ? <RiLoader4Line className="h-4 w-4 animate-spin" /> : <RiLock2Line className="h-4 w-4" />}
                          Release
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default VmSpawner;
