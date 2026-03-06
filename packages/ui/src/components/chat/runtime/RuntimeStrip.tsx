import React from 'react';
import {
  RiExternalLinkLine,
  RiLoader4Line,
  RiComputerLine,
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiTimeLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useAgentRuntimeStore } from '@/stores/useAgentRuntimeStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useDirectoryStore } from '@/stores/useDirectoryStore';
import { openUrlInAppBrowser } from '@/lib/browser/openInApp';

const modeLabel = (mode: 'openbrowser' | 'e2b' | 'desktop-browser' | 'browseros' | 'user-desktop'): string => {
  if (mode === 'e2b') return 'E2B Desktop';
  if (mode === 'browseros') return 'KronosOS Browser';
  if (mode === 'desktop-browser') return 'Live Browser';
  if (mode === 'user-desktop') return 'User Desktop';
  return 'OpenBrowser';
};

const statusLabel = (status: 'queued' | 'running' | 'done', success: boolean | null): string => {
  if (status === 'queued') return 'Queued';
  if (status === 'running') return 'Running';
  if (success === true) return 'Done';
  if (success === false) return 'Failed';
  return 'Done';
};

export const RuntimeStrip: React.FC = () => {
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const setPendingInputText = useSessionStore((state) => state.setPendingInputText);
  const currentDirectory = useDirectoryStore((state) => state.currentDirectory);
  const bindSession = useAgentRuntimeStore((state) => state.bindSession);
  const tasksByID = useAgentRuntimeStore((state) => state.tasksByID);
  const orderedTaskIDs = useAgentRuntimeStore((state) => state.orderedTaskIDs);

  React.useEffect(() => {
    void bindSession(currentSessionId ?? null);
  }, [bindSession, currentSessionId]);

  const tasks = React.useMemo(() => {
    const activeSession = currentSessionId ?? null;
    return orderedTaskIDs
      .map((taskID) => tasksByID[taskID])
      .filter((task): task is NonNullable<typeof task> => Boolean(task))
      .filter((task) => {
        if (!activeSession) return true;
        return task.sessionID === activeSession;
      })
      .slice(0, 3);
  }, [currentSessionId, orderedTaskIDs, tasksByID]);

  if (tasks.length === 0) {
    return null;
  }

  const latest = tasks[0];

  return (
    <div className="border-b border-border/60 bg-card/35 px-3 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/75 px-2 py-1 text-[11px] font-medium text-foreground">
          <RiComputerLine className="h-3.5 w-3.5 text-primary" />
          AI Runtime
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          {tasks.map((task) => (
            <div
              key={task.taskID}
              className={cn(
                'inline-flex min-w-[220px] max-w-[420px] items-center gap-2 rounded-full border px-2 py-1 text-[11px]',
                task.status === 'running' && 'border-primary/40 bg-primary/10',
                task.status === 'queued' && 'border-primary/30 bg-primary/5',
                task.status === 'done' && task.success === true && 'border-status-success/30 bg-status-success/10',
                task.status === 'done' && task.success === false && 'border-status-error/30 bg-status-error/10',
                task.status === 'done' && task.success === null && 'border-border/70 bg-background/75',
              )}
            >
              <span className="shrink-0 rounded-md border border-border/60 px-1.5 py-0.5 uppercase tracking-wide text-[10px] text-muted-foreground">
                {modeLabel((task.requestedMode ?? task.mode) as 'openbrowser' | 'e2b' | 'desktop-browser' | 'browseros' | 'user-desktop')}
              </span>
              <span className="truncate text-foreground">{task.prompt || 'Runtime task'}</span>
              <span className="shrink-0 inline-flex items-center gap-1 text-muted-foreground">
                {task.status === 'running' ? <RiLoader4Line className="h-3 w-3 animate-spin text-primary" /> : null}
                {task.status === 'queued' ? <RiTimeLine className="h-3 w-3 text-primary" /> : null}
                {task.status === 'done' && task.success === true ? <RiCheckboxCircleLine className="h-3 w-3 text-status-success" /> : null}
                {task.status === 'done' && task.success === false ? <RiErrorWarningLine className="h-3 w-3 text-status-error" /> : null}
                <span>{statusLabel(task.status, task.success)}</span>
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => {
              const prompt = typeof latest.prompt === 'string' ? latest.prompt.trim() : '';
              setPendingInputText(`/desktoptask ${latest.mode} ${prompt}`.trimEnd(), 'replace');
            }}
          >
            Resume
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-xs"
            disabled={!latest.liveUrl}
            onClick={() => {
              if (!latest.liveUrl) return;
              void openUrlInAppBrowser({
                url: latest.liveUrl,
                sessionID: latest.sessionID ?? currentSessionId,
                directory: currentDirectory,
              }).then((opened) => {
                if (!opened) {
                  toast.info('Switched to in-app browser. Select an active session to navigate.');
                }
              });
            }}
          >
            Live
            <RiExternalLinkLine className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
