import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RiCloseLine, RiExpandDiagonalLine, RiPushpin2Fill, RiPushpin2Line } from '@remixicon/react';
import { cn } from '@/lib/utils';
import type { AgentWorkSnapshot } from '@/hooks/useAgentWorkSnapshot';
import type { AgentRuntimeTask } from '@/stores/useAgentRuntimeStore';

type DesktopHoverAssistSurfaceProps = {
  visible: boolean;
  task: AgentRuntimeTask | null;
  snapshot: AgentWorkSnapshot | null;
  pinned: boolean;
  onTogglePinned: () => void;
  onClose: () => void;
  onOpenRuntime: () => void;
};

const taskStatusLabel = (status: AgentRuntimeTask['status'] | null | undefined): string => {
  if (status === 'running') return 'running';
  if (status === 'queued') return 'queued';
  if (status === 'done') return 'done';
  return 'idle';
};

const shortTaskID = (value: string | null | undefined): string => {
  if (!value) return 'unknown';
  return value.length > 10 ? `${value.slice(0, 10)}…` : value;
};

export const DesktopHoverAssistSurface: React.FC<DesktopHoverAssistSurfaceProps> = ({
  visible,
  task,
  snapshot,
  pinned,
  onTogglePinned,
  onClose,
  onOpenRuntime,
}) => {
  const status = taskStatusLabel(task?.status ?? null);
  const cwd = snapshot?.cwd ?? snapshot?.root ?? 'unknown';

  return (
    <AnimatePresence>
      {visible ? (
        <motion.aside
          key="desktop-hover-assist"
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.16 }}
          className={cn(
            'fixed bottom-5 left-1/2 z-[80] w-[min(92vw,560px)] -translate-x-1/2 overflow-hidden rounded-[28px] border border-border/60 bg-background/78 p-4 shadow-2xl backdrop-blur-xl',
            'text-foreground',
          )}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{ background: 'radial-gradient(120% 140% at 50% 0%, var(--status-info-background) 0%, transparent 58%)' }}
          />

          <div className="relative flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Desktop follow</div>
              <div className="mt-1 typography-ui-label font-medium">Desktop Hover Assist</div>
              <div className="typography-meta mt-1 text-muted-foreground">
                Task {shortTaskID(task?.taskID ?? null)} • {status}
              </div>
            </div>
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={onTogglePinned}
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground hover:bg-interactive-hover/50 hover:text-foreground',
                  pinned && 'text-foreground border-interactive-selection/70 bg-interactive-selection/20',
                )}
                title={pinned ? 'Unpin hover assist' : 'Pin hover assist'}
                aria-label={pinned ? 'Unpin hover assist' : 'Pin hover assist'}
              >
                {pinned ? <RiPushpin2Fill className="h-4 w-4" /> : <RiPushpin2Line className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background/70 text-muted-foreground hover:bg-interactive-hover/50 hover:text-foreground"
                title="Close hover assist"
                aria-label="Close hover assist"
              >
                <RiCloseLine className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="relative mt-3 rounded-2xl border border-border/60 bg-background/55 px-3 py-2 font-mono text-[11px] text-foreground/90" title={cwd}>
            {cwd}
          </div>

          <div className="relative mt-3 flex items-center justify-between gap-2">
            <div className="typography-meta text-muted-foreground">
              Mode: <span className="text-foreground">{task?.mode ?? snapshot?.work_type ?? 'idle'}</span>
            </div>
            <button
              type="button"
              onClick={onOpenRuntime}
              className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs text-foreground hover:bg-interactive-hover/50"
            >
              <RiExpandDiagonalLine className="h-3.5 w-3.5" />
              Follow live
            </button>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
};

export default DesktopHoverAssistSurface;
