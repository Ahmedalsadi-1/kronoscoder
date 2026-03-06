import React from 'react';
import type { Message, Part } from '@kronoscode-ai/sdk/v2';
import { desktopHostsGet } from '@/lib/desktopHosts';
import { isDesktopShell } from '@/lib/desktop';
import { orderRuntimeHosts, resolveBestRuntimeHost } from '@/lib/runtimeHostResolver';
import type { AgentRuntimeTask } from '@/stores/useAgentRuntimeStore';
import { useAgentRuntimeStore } from '@/stores/useAgentRuntimeStore';
import { useDirectoryStore } from '@/stores/useDirectoryStore';
import { useSessionStore } from '@/stores/useSessionStore';

const EMPTY_MESSAGES: Array<{ info: Message; parts: Part[] }> = [];

export type AgentWorkType = 'coding' | 'browsing' | 'mobile' | 'research' | 'validation' | 'idle';
export type AgentWorkStatus = 'running' | 'idle' | 'retrying';

export type AgentWorkSnapshot = {
  cwd: string | null;
  root: string | null;
  work_type: AgentWorkType;
  tool_name: string | null;
  runtime_target: string | null;
  status: AgentWorkStatus;
  started_at: number | null;
  elapsed_ms: number;
  runtime_host: string | null;
  has_media_activity: boolean;
};

type ToolCandidate = {
  toolName: string | null;
  isRunning: boolean;
  startTime: number | null;
  cwd: string | null;
  root: string | null;
  runtimeTarget: string | null;
  hasMediaActivity: boolean;
};

type SessionStatusMetadata = {
  activeTool?: string;
  workType?: string;
  runtimeTarget?: string;
};

const TOOL_KEYWORDS = {
  browsing: /(browser|playwright|navigate|open_url|web|scrape|viewport|snapshot|openbrowser|desktop-browser|browseros)/i,
  mobile: /(android|ios|mobile|gbox|simulator|emulator|phone|tablet|device)/i,
  research: /(search|lookup|query|fetch|crawl|perplexity|web_query)/i,
  validation: /(test|lint|typecheck|validate|verify|check|review)/i,
  media: /(image|images|screenshot|video|frame|thumbnail|camera|recording|render|pdf)/i,
};

const WORK_TYPES: AgentWorkType[] = ['coding', 'browsing', 'mobile', 'research', 'validation', 'idle'];

const normalizePath = (value: unknown): string | null => {
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

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const firstText = (...candidates: unknown[]): string | null => {
  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return null;
};

const extractPathFromRecord = (record: Record<string, unknown>): { cwd: string | null; root: string | null } => {
  const pathCandidate = asRecord(record.path);
  const locationCandidate = asRecord(record.location);
  const cwd = normalizePath(
    firstText(
      record.cwd,
      record.directory,
      record.workdir,
      record.workingDirectory,
      pathCandidate?.cwd,
      pathCandidate?.directory,
      locationCandidate?.cwd,
      locationCandidate?.directory,
    ),
  );
  const root = normalizePath(firstText(record.root, pathCandidate?.root, locationCandidate?.root));
  return { cwd, root };
};

const extractRuntimeTarget = (record: Record<string, unknown>): string | null => {
  const target = firstText(
    record.url,
    record.target,
    record.destination,
    record.toAddress,
    record.to,
    record.path,
    record.file,
    record.selector,
  );
  return normalizeText(target);
};

const hasMediaInRecord = (record: Record<string, unknown>): boolean => {
  const joined = [
    firstText(record.tool),
    firstText(record.url),
    firstText(record.path),
    firstText(record.selector),
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ');
  return TOOL_KEYWORDS.media.test(joined);
};

const extractToolCandidate = (part: Part): ToolCandidate | null => {
  if (part.type !== 'tool') {
    return null;
  }

  const partRecord = asRecord(part);
  const state = asRecord(partRecord?.state);
  const stateStatus = normalizeText(state?.status);
  const stateTime = asRecord(state?.time);
  const stateInput = asRecord(state?.input);
  const stateMeta = asRecord(state?.metadata);
  const metadata = asRecord(partRecord?.metadata);

  const running = stateStatus === 'running' || stateStatus === 'pending';
  const startTime =
    typeof stateTime?.start === 'number' && Number.isFinite(stateTime.start) ? stateTime.start : null;

  const pathFromInput = stateInput ? extractPathFromRecord(stateInput) : { cwd: null, root: null };
  const pathFromMeta = stateMeta ? extractPathFromRecord(stateMeta) : { cwd: null, root: null };
  const pathFromPartMeta = metadata ? extractPathFromRecord(metadata) : { cwd: null, root: null };

  const runtimeTarget = firstText(
    stateInput ? extractRuntimeTarget(stateInput) : null,
    stateMeta ? extractRuntimeTarget(stateMeta) : null,
    metadata ? extractRuntimeTarget(metadata) : null,
  );

  const toolName = normalizeText(partRecord?.tool);
  const hasMediaActivity =
    TOOL_KEYWORDS.media.test(toolName ?? '') ||
    (stateInput ? hasMediaInRecord(stateInput) : false) ||
    (stateMeta ? hasMediaInRecord(stateMeta) : false) ||
    (metadata ? hasMediaInRecord(metadata) : false);

  return {
    toolName,
    isRunning: running,
    startTime,
    cwd: pathFromInput.cwd ?? pathFromMeta.cwd ?? pathFromPartMeta.cwd,
    root: pathFromInput.root ?? pathFromMeta.root ?? pathFromPartMeta.root,
    runtimeTarget,
    hasMediaActivity,
  };
};

const pickToolCandidate = (messages: Array<{ info: Message; parts: Part[] }>): ToolCandidate | null => {
  const candidates: ToolCandidate[] = [];
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const entry = messages[messageIndex];
    if (!entry || entry.info.role !== 'assistant') {
      continue;
    }
    for (let partIndex = entry.parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const candidate = extractToolCandidate(entry.parts[partIndex] as Part);
      if (!candidate) {
        continue;
      }
      candidates.push(candidate);
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  return candidates.find((candidate) => candidate.isRunning) ?? candidates[0];
};

const pickAssistantPath = (messages: Array<{ info: Message; parts: Part[] }>): { cwd: string | null; root: string | null } => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.info.role !== 'assistant') {
      continue;
    }
    const infoRecord = asRecord(message.info);
    const pathRecord = asRecord(infoRecord?.path);
    if (!pathRecord) {
      continue;
    }
    const cwd = normalizePath(pathRecord.cwd);
    const root = normalizePath(pathRecord.root);
    if (cwd || root) {
      return { cwd, root };
    }
  }
  return { cwd: null, root: null };
};

const normalizeWorkType = (value: unknown): AgentWorkType | null => {
  if (typeof value !== 'string') {
    return null;
  }
  return WORK_TYPES.includes(value as AgentWorkType) ? (value as AgentWorkType) : null;
};

const classifyWorkType = (
  status: AgentWorkStatus,
  toolName: string | null,
  runtimeTask: AgentRuntimeTask | null
): AgentWorkType => {
  if (status === 'idle') {
    return 'idle';
  }

  const stack = [toolName, runtimeTask?.mode, runtimeTask?.requestedMode, runtimeTask?.routingReason]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ');

  if (TOOL_KEYWORDS.mobile.test(stack)) {
    return 'mobile';
  }
  if (TOOL_KEYWORDS.browsing.test(stack)) {
    return 'browsing';
  }
  if (TOOL_KEYWORDS.research.test(stack)) {
    return 'research';
  }
  if (TOOL_KEYWORDS.validation.test(stack)) {
    return 'validation';
  }
  return 'coding';
};

const deriveRuntimeTarget = (toolTarget: string | null, runtimeTask: AgentRuntimeTask | null): string | null => {
  const runtimeTarget = firstText(runtimeTask?.liveUrl, runtimeTask?.runtimeSessionID, runtimeTask?.mode);
  return normalizeText(toolTarget ?? runtimeTarget);
};

const resolveWorkingLocation = (input: {
  assistantPath: { cwd: string | null; root: string | null };
  toolCandidate: ToolCandidate | null;
  sessionDirectory: string | null;
  currentDirectory: string | null;
}) => {
  const sessionPath = normalizePath(input.sessionDirectory);
  const currentPath = normalizePath(input.currentDirectory);
  return {
    cwd: input.assistantPath.cwd ?? input.toolCandidate?.cwd ?? sessionPath ?? currentPath,
    root: input.assistantPath.root ?? input.toolCandidate?.root ?? sessionPath ?? currentPath,
  };
};

const deriveToolName = (
  statusMeta: SessionStatusMetadata | null | undefined,
  toolCandidate: ToolCandidate | null,
  runtimeTask: AgentRuntimeTask | null,
): string | null => {
  return normalizeText(statusMeta?.activeTool) ?? toolCandidate?.toolName ?? (runtimeTask?.mode ?? null);
};

const deriveWorkType = (
  status: AgentWorkStatus,
  statusMeta: SessionStatusMetadata | null | undefined,
  toolName: string | null,
  runtimeTask: AgentRuntimeTask | null,
): AgentWorkType => {
  const statusWorkType = normalizeWorkType(statusMeta?.workType);
  if (statusWorkType) {
    return status === 'idle' ? 'idle' : statusWorkType;
  }
  return classifyWorkType(status, toolName, runtimeTask);
};

const deriveStatusRuntimeTarget = (
  statusMeta: SessionStatusMetadata | null | undefined,
  toolCandidate: ToolCandidate | null,
  runtimeTask: AgentRuntimeTask | null,
): string | null => {
  const statusTarget = normalizeText(statusMeta?.runtimeTarget);
  if (statusTarget) {
    return statusTarget;
  }
  return deriveRuntimeTarget(toolCandidate?.runtimeTarget ?? null, runtimeTask);
};

const pickActiveRuntimeTask = (
  tasksByID: Record<string, AgentRuntimeTask>,
  orderedTaskIDs: string[],
  sessionID: string | null
): AgentRuntimeTask | null => {
  if (!sessionID) {
    return null;
  }

  const tasks = orderedTaskIDs
    .map((taskId) => tasksByID[taskId])
    .filter((task): task is AgentRuntimeTask => Boolean(task))
    .filter((task) => task.sessionID === sessionID);

  if (tasks.length === 0) {
    return null;
  }

  const active = tasks.find((task) => task.status === 'running' || task.status === 'queued');
  if (active) {
    return active;
  }

  return tasks.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
};

export const useAgentWorkSnapshot = (): AgentWorkSnapshot | null => {
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const currentDirectory = useDirectoryStore((state) => state.currentDirectory);
  const tasksByID = useAgentRuntimeStore((state) => state.tasksByID);
  const orderedTaskIDs = useAgentRuntimeStore((state) => state.orderedTaskIDs);

  const sessionMessages = useSessionStore(
    React.useCallback(
      (state) => (currentSessionId ? state.messages.get(currentSessionId) ?? EMPTY_MESSAGES : EMPTY_MESSAGES),
      [currentSessionId]
    )
  );
  const sessionStatus = useSessionStore(
    React.useCallback(
      (state) => (currentSessionId ? state.sessionStatus?.get(currentSessionId) : undefined),
      [currentSessionId]
    )
  );
  const sessionDirectory = useSessionStore(
    React.useCallback((state) => {
      if (!currentSessionId) {
        return null;
      }

      const metadata = state.worktreeMetadata.get(currentSessionId);
      const metadataPath = normalizePath(metadata?.path);
      if (metadataPath) {
        return metadataPath;
      }

      const session = state.sessions.find((item) => item.id === currentSessionId) as { directory?: string | null } | undefined;
      return normalizePath(session?.directory);
    }, [currentSessionId])
  );

  const activeRuntimeTask = React.useMemo(() => {
    return pickActiveRuntimeTask(tasksByID, orderedTaskIDs, currentSessionId ?? null);
  }, [tasksByID, orderedTaskIDs, currentSessionId]);

  const toolCandidate = React.useMemo(() => pickToolCandidate(sessionMessages), [sessionMessages]);
  const assistantPath = React.useMemo(() => pickAssistantPath(sessionMessages), [sessionMessages]);

  const status: AgentWorkStatus =
    sessionStatus?.type === 'busy' ? 'running' : sessionStatus?.type === 'retry' ? 'retrying' : 'idle';

  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (status === 'idle') {
      return;
    }
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [status]);

  const startedAt =
    toolCandidate?.startTime ??
    activeRuntimeTask?.startedAt ??
    (activeRuntimeTask && (activeRuntimeTask.status === 'running' || activeRuntimeTask.status === 'queued')
      ? activeRuntimeTask.updatedAt
      : null);

  const elapsedMs =
    status === 'idle' || !startedAt ? 0 : Math.max(0, now - startedAt);

  const { cwd, root } = resolveWorkingLocation({
    assistantPath,
    toolCandidate,
    sessionDirectory: normalizePath(sessionDirectory),
    currentDirectory: normalizePath(currentDirectory),
  });

  const statusMetadata =
    sessionStatus && (sessionStatus.type === 'busy' || sessionStatus.type === 'idle' || sessionStatus.type === 'retry')
      ? (sessionStatus as SessionStatusMetadata)
      : undefined;
  const toolName = deriveToolName(statusMetadata, toolCandidate, activeRuntimeTask);
  const workType = deriveWorkType(status, statusMetadata, toolName, activeRuntimeTask);
  const runtimeTarget = deriveStatusRuntimeTarget(statusMetadata, toolCandidate, activeRuntimeTask);

  const [resolvedRuntimeHost, setResolvedRuntimeHost] = React.useState<string | null>('local');
  const shouldResolveRuntimeHost =
    isDesktopShell() &&
    (status === 'running' || status === 'retrying') &&
    (workType === 'browsing' || workType === 'mobile');

  React.useEffect(() => {
    if (!shouldResolveRuntimeHost) {
      setResolvedRuntimeHost('local');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const config = await desktopHostsGet();
        const ordered = orderRuntimeHosts(config.hosts ?? [], config.defaultHostId);
        const resolved = await resolveBestRuntimeHost(ordered);
        if (cancelled) {
          return;
        }
        if (resolved === 'local') {
          setResolvedRuntimeHost('local');
          return;
        }
        const label = normalizeText(resolved.label) ?? normalizeText(resolved.id) ?? 'remote';
        setResolvedRuntimeHost(label);
      } catch {
        if (!cancelled) {
          setResolvedRuntimeHost('local');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shouldResolveRuntimeHost, currentSessionId, workType, status]);

  const runtimeHost = shouldResolveRuntimeHost
    ? resolvedRuntimeHost
    : normalizeText(activeRuntimeTask?.routedProvider) ?? resolvedRuntimeHost;

  if (!currentSessionId) {
    return null;
  }

  return {
    cwd: cwd ?? null,
    root: root ?? null,
    work_type: workType,
    tool_name: toolName,
    runtime_target: runtimeTarget,
    status,
    started_at: startedAt ?? null,
    elapsed_ms: elapsedMs,
    runtime_host: runtimeHost,
    has_media_activity: Boolean(toolCandidate?.hasMediaActivity || activeRuntimeTask?.liveUrl),
  };
};

export const __agentWorkSnapshotTestUtils = {
  pickToolCandidate,
  pickAssistantPath,
  classifyWorkType,
  resolveWorkingLocation,
  deriveToolName,
  deriveWorkType,
  deriveStatusRuntimeTarget,
};
