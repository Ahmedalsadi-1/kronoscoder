import React from 'react';
import { RiMagicLine, RiSearch2Line, RiTerminalLine, RiComputerLine, RiCloseLine } from '@remixicon/react';
import { desktopBrowserSelectionState, type DesktopBrowserSelection } from '@/lib/desktop';
import { useUIStore } from '@/stores/useUIStore';
import { runtimeSdk } from '@/lib/runtimeSdk';
import { useSessionStore } from '@/stores/useSessionStore';
import { useConfigStore } from '@/stores/useConfigStore';
import { toast } from '@/components/ui';

export const BrowserSelectionBubble: React.FC = () => {
  const [selection, setSelection] = React.useState<DesktopBrowserSelection | null>(null);
  const [showDesktopChoice, setShowDesktopChoice] = React.useState(false);
  const activeMainTab = useUIStore((state) => state.activeMainTab);
  const setActiveMainTab = useUIStore((state) => state.setActiveMainTab);
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const createSession = useSessionStore((state) => state.createSession);
  const saveSessionAgentSelection = useSessionStore((state) => state.saveSessionAgentSelection);
  const setPendingInputText = useSessionStore((state) => state.setPendingInputText);
  const currentAgentName = useConfigStore((state) => state.currentAgentName);
  const getVisibleAgents = useConfigStore((state) => state.getVisibleAgents);

  const { browserAgentName, desktopAgentName } = React.useMemo(() => {
    const agents = getVisibleAgents();
    const browserAgent = agents.find((agent) => agent.name === 'kronos-browser-agent')?.name ?? currentAgentName;
    const desktopAgent = agents.find((agent) => agent.name === 'kronos-desktop-agent')?.name ?? currentAgentName;
    return {
      browserAgentName: browserAgent || null,
      desktopAgentName: desktopAgent || null,
    };
  }, [currentAgentName, getVisibleAgents]);

  // Poll for selection state when in browser tab
  React.useEffect(() => {
    if (activeMainTab !== 'browser') {
      setSelection(null);
      return;
    }

    const interval = setInterval(async () => {
      try {
        const state = await desktopBrowserSelectionState();
        if (state && state.text.length > 0) {
          setSelection(state);
        } else {
          setSelection(null);
        }
      } catch {
        setSelection(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeMainTab]);

  if (!selection) return null;

  const ensureSession = React.useCallback(async (): Promise<string | null> => {
    if (currentSessionId) return currentSessionId;
    const session = await createSession('Browser Task');
    return session?.id ?? null;
  }, [createSession, currentSessionId]);

  const handleAsk = async () => {
    const prompt = `Based on my selection from ${selection.url}:\n\n"${selection.text}"\n\n`;
    const sessionID = await ensureSession();
    if (sessionID && browserAgentName) {
      saveSessionAgentSelection(sessionID, browserAgentName);
    }
    setPendingInputText(prompt, 'replace');
    setActiveMainTab('chat');
    setShowDesktopChoice(false);
  };

  const handleRunTask = async (mode: 'browseros' | 'desktop-browser' | 'e2b' | 'user-desktop', agentName: string | null) => {
    const sessionID = await ensureSession();
    if (!sessionID) return;
    if (agentName) {
      saveSessionAgentSelection(sessionID, agentName);
    }
    try {
      await runtimeSdk.createTask({
        prompt: `Process this selection from ${selection.url}:\n\n${selection.text}`,
        mode,
        sessionID,
        background: true,
        agentName: agentName ?? undefined,
      });
      if (mode === 'browseros' || mode === 'desktop-browser') {
        setActiveMainTab('browser');
      } else {
        setActiveMainTab('chat');
      }
      setShowDesktopChoice(false);
      toast.success(`${mode} task started`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to run selection task';
      toast.error(message);
    }
  };

  return (
    <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50">
      {showDesktopChoice && (
        <div className="absolute bottom-14 left-1/2 z-50 w-[360px] -translate-x-1/2 rounded-xl border border-border/80 bg-background/95 p-2 shadow-2xl backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between px-2 py-1">
            <p className="text-[11px] font-medium text-muted-foreground">Choose desktop task mode</p>
            <button
              type="button"
              onClick={() => setShowDesktopChoice(false)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <RiCloseLine className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void handleRunTask('user-desktop', desktopAgentName)}
              className="flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <RiComputerLine className="h-3.5 w-3.5" />
              Full control
            </button>
            <button
              onClick={() => void handleRunTask('e2b', desktopAgentName)}
              className="flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <RiTerminalLine className="h-3.5 w-3.5" />
              Background task
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 rounded-full border border-border/80 bg-background/95 p-1 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300">
        <button
          onClick={() => void handleAsk()}
          className="flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <RiMagicLine className="h-3.5 w-3.5" />
          Ask Kronos Browser Agent
        </button>

        <div className="h-4 w-px bg-border/60 mx-1" />

        <button
          onClick={() => void handleRunTask('browseros', browserAgentName)}
          className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Run with KronosOS browser agent"
        >
          <RiSearch2Line className="h-3.5 w-3.5" />
          KronosOS Task
        </button>

        <button
          onClick={() => void handleRunTask('desktop-browser', browserAgentName)}
          className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Run with desktop interactive browser runtime"
        >
          <RiSearch2Line className="h-3.5 w-3.5" />
          Desktop Browser
        </button>

        <button
          onClick={() => setShowDesktopChoice((value) => !value)}
          className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Choose full-control or background worker"
        >
          <RiComputerLine className="h-3.5 w-3.5" />
          User Desktop
        </button>

        <button
          onClick={() => void handleRunTask('e2b', desktopAgentName)}
          className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Run as background worker (E2B)"
        >
          <RiTerminalLine className="h-3.5 w-3.5" />
          Background Worker
        </button>
      </div>
    </div>
  );
};
