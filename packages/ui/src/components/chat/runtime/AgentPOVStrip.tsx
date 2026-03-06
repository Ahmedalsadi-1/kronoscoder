import React from 'react';
import { cn } from '@/lib/utils';
import type { AgentWorkSnapshot } from '@/hooks/useAgentWorkSnapshot';
import { useUIStore } from '@/stores/useUIStore';

type AgentPOVStripProps = {
  snapshot: AgentWorkSnapshot | null;
};

const formatElapsed = (elapsedMs: number): string => {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return '00:00';
  }
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const minuteLabel = String(minutes).padStart(2, '0');
  const secondLabel = String(seconds).padStart(2, '0');
  return `${minuteLabel}:${secondLabel}`;
};

const statusToneClass = (status: AgentWorkSnapshot['status']): string => {
  if (status === 'running') {
    return 'border-[var(--status-info-border)] bg-[var(--status-info-background)] text-[var(--status-info)]';
  }
  if (status === 'retrying') {
    return 'border-[var(--status-warning-border)] bg-[var(--status-warning-background)] text-[var(--status-warning)]';
  }
  return 'border-border/70 bg-muted/50 text-muted-foreground';
};

const statusLabel = (status: AgentWorkSnapshot['status']): string => {
  if (status === 'running') return 'Running';
  if (status === 'retrying') return 'Retrying';
  return 'Idle';
};

export const AgentPOVStrip: React.FC<AgentPOVStripProps> = ({ snapshot }) => {
  const {
    agentPovAlwaysVisible,
    povPinned,
    setPovPinned,
    setPovAutoSplitSuppressed,
    setRuntimeAutoSplitEngaged,
    runtimeAutoSplitEngaged,
    activeMainTab,
    setActiveMainTab,
  } = useUIStore((state) => ({
    agentPovAlwaysVisible: state.agentPovAlwaysVisible,
    povPinned: state.povPinned,
    setPovPinned: state.setPovPinned,
    setPovAutoSplitSuppressed: state.setPovAutoSplitSuppressed,
    setRuntimeAutoSplitEngaged: state.setRuntimeAutoSplitEngaged,
    runtimeAutoSplitEngaged: state.runtimeAutoSplitEngaged,
    activeMainTab: state.activeMainTab,
    setActiveMainTab: state.setActiveMainTab,
  }));

  if (!agentPovAlwaysVisible) {
    return null;
  }

  const path = snapshot?.cwd ?? snapshot?.root ?? 'Unknown location';
  const workType = snapshot?.work_type ?? 'idle';
  const tool = snapshot?.tool_name ?? 'waiting';
  const runtimeTarget = snapshot?.runtime_target ?? 'none';
  const runtimeHost = snapshot?.runtime_host ?? 'local';
  const status = snapshot?.status ?? 'idle';
  const elapsed = formatElapsed(snapshot?.elapsed_ms ?? 0);
  const showSplitClose = runtimeAutoSplitEngaged && activeMainTab === 'browser';

  return (
    <div className="sticky top-0 z-20 border-b border-border/60 bg-card/80 px-3 py-2 backdrop-blur">
      <div className="flex min-w-0 items-center gap-2">
        <div
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium',
            statusToneClass(status),
          )}
        >
          {status === 'running' ? (
            <span className="inline-block h-2 w-2 rounded-full bg-current animate-pulse" />
          ) : null}
          <span>{statusLabel(status)}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <span className="inline-flex min-w-0 items-center gap-1 text-foreground">
            <span className="shrink-0 text-muted-foreground">Working in</span>
            <span className="min-w-0 truncate font-mono" title={path}>
              {path}
            </span>
          </span>

          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <span className="shrink-0 uppercase tracking-wide text-[10px]">Work</span>
            <span className="text-foreground">{workType}</span>
          </span>

          <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
            <span className="shrink-0 uppercase tracking-wide text-[10px]">Tool</span>
            <span className="truncate text-foreground" title={tool}>
              {tool}
            </span>
          </span>

          <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
            <span className="shrink-0 uppercase tracking-wide text-[10px]">Target</span>
            <span className="truncate text-foreground" title={runtimeTarget}>
              {runtimeTarget}
            </span>
          </span>

          <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
            <span className="shrink-0 uppercase tracking-wide text-[10px]">Host</span>
            <span className="truncate text-foreground" title={runtimeHost}>
              {runtimeHost}
            </span>
          </span>

          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <span className="shrink-0 uppercase tracking-wide text-[10px]">Elapsed</span>
            <span className="font-mono text-foreground">{elapsed}</span>
          </span>
        </div>

        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPovPinned(!povPinned)}
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:bg-interactive-hover/50 hover:text-foreground',
              povPinned && 'text-foreground border-interactive-selection/70 bg-interactive-selection/20',
            )}
            aria-label={povPinned ? 'Unpin runtime split' : 'Pin runtime split'}
            title={povPinned ? 'Unpin runtime split' : 'Pin runtime split'}
          >
            <span className="typography-micro">{povPinned ? 'Unpin' : 'Pin'}</span>
          </button>

          {showSplitClose ? (
            <button
              type="button"
              onClick={() => {
                setPovAutoSplitSuppressed(true);
                setRuntimeAutoSplitEngaged(false);
                setActiveMainTab('chat');
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/70 text-muted-foreground hover:bg-interactive-hover/50 hover:text-foreground"
              aria-label="Close auto split view"
              title="Close auto split view"
            >
              <span aria-hidden className="text-sm leading-none">x</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
