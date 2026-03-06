// packages/ui/src/components/layout/RuntimeContextPanel.tsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import { RiArrowLeftLine, RiExternalLinkLine, RiLinkM, RiErrorWarningLine } from '@remixicon/react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useAgentRuntimeStore } from '@/stores/useAgentRuntimeStore';
import { useUIStore } from '@/stores/useUIStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { CodeBlock } from '@/components/ui/code-block';
import { toast } from '@/components/ui';
import { openUrlInAppBrowser } from '@/lib/browser/openInApp';

interface RuntimeContextPanelProps {
  directory: string;
  taskID: string;
}

type RuntimeTab = 'live' | 'files' | 'logs';

export const RuntimeContextPanel: React.FC<RuntimeContextPanelProps> = ({ directory, taskID }) => {
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const tasksByID = useAgentRuntimeStore((state) => state.tasksByID);
  const { closeContextPanel } = useUIStore();

  const currentTask = useMemo(() => {
    return tasksByID[taskID] ?? null;
  }, [tasksByID, taskID]);

  const [activeTab, setActiveTab] = useState<RuntimeTab>('live');

  useEffect(() => {
    if (currentTask?.liveUrl && activeTab !== 'live') {
      setActiveTab('live');
    } else if (!currentTask?.liveUrl && activeTab === 'live') {
      setActiveTab('logs');
    }
  }, [currentTask?.liveUrl, activeTab]);

  const handleOpenLiveUrl = useCallback(() => {
    const liveUrl = currentTask?.liveUrl;
    if (!liveUrl) return;
    void openUrlInAppBrowser({
      url: liveUrl,
      sessionID: currentTask?.sessionID ?? currentSessionId,
      directory,
    }).then((opened) => {
      if (!opened) {
        toast.info('Switched to in-app browser. Select an active session to navigate.');
      }
    });
  }, [currentSessionId, currentTask?.liveUrl, currentTask?.sessionID, directory]);

  const openArtifact = useCallback((artifact: Record<string, unknown>) => {
    const url = typeof artifact.url === 'string' && artifact.url.trim().length > 0
      ? artifact.url.trim()
      : null;
    const filePath = typeof artifact.path === 'string' && artifact.path.trim().length > 0
      ? artifact.path.trim()
      : null;
    if (url) {
      void openUrlInAppBrowser({
        url,
        sessionID: currentTask?.sessionID ?? currentSessionId,
        directory,
      }).then((opened) => {
        if (!opened) {
          toast.info('Artifact link kept in-app. Select an active session to navigate.');
        }
      });
      return;
    }

    if (!filePath) return;
    void navigator.clipboard.writeText(filePath).then(() => {
      toast.info('Artifact file path copied to clipboard.');
    }).catch(() => {
      toast.info(filePath);
    });
  }, [currentSessionId, currentTask?.sessionID, directory]);

  const isImageArtifact = useCallback((artifact: Record<string, unknown>) => {
    const mimeType = typeof artifact.mimeType === 'string' ? artifact.mimeType.toLowerCase() : '';
    if (mimeType.startsWith('image/')) return true;
    const url = typeof artifact.url === 'string' ? artifact.url.toLowerCase() : '';
    return /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(url);
  }, []);

  const isVideoArtifact = useCallback((artifact: Record<string, unknown>) => {
    const mimeType = typeof artifact.mimeType === 'string' ? artifact.mimeType.toLowerCase() : '';
    if (mimeType.startsWith('video/')) return true;
    const url = typeof artifact.url === 'string' ? artifact.url.toLowerCase() : '';
    return /\.(mp4|mov|webm|m4v)$/.test(url);
  }, []);

  if (!currentTask) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground">
        <RiErrorWarningLine className="h-10 w-10 mb-2" />
        <p>Runtime task not found.</p>
        <Button variant="ghost" onClick={() => closeContextPanel(directory)}>
          <RiArrowLeftLine className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
      <div className="flex items-center justify-between p-2 border-b">
        <Button variant="ghost" size="sm" onClick={() => closeContextPanel(directory)}>
          <RiArrowLeftLine className="h-4 w-4 mr-2" /> Back
        </Button>
        <span className="text-sm font-medium truncate">{currentTask.agentName || 'Runtime Task'}</span>
        <div className="flex items-center gap-1">
          {currentTask.liveUrl && (
            <Button variant="ghost" size="sm" onClick={handleOpenLiveUrl} title="Open Live URL Externally">
              <RiExternalLinkLine className="h-4 w-4" />
            </Button>
          )}
          {/* TODO: Add more actions if needed, e.g., restart, stop */}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as RuntimeTab)} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="live" disabled={!currentTask.liveUrl}>Live</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        <Separator />

        <TabsContent value="live" className="flex-1 p-2">
          {currentTask.liveUrl ? (
            <iframe src={currentTask.liveUrl} className="w-full h-full border-none rounded-md" />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">No live URL available.</div>
          )}
        </TabsContent>

        <TabsContent value="files" className="flex-1 p-2">
          <ScrollArea className="h-full">
            {currentTask.artifacts && currentTask.artifacts.length > 0 ? (
              <ul className="space-y-2">
                {currentTask.artifacts.map((artifact, index) => (
                  <li key={index} className="space-y-2 p-2 bg-muted rounded-md text-sm">
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 text-left hover:text-primary transition-colors"
                      onClick={() => openArtifact(artifact as Record<string, unknown>)}
                    >
                      <RiLinkM className="h-4 w-4 flex-shrink-0" />
                      <span className="font-mono truncate">
                        {artifact.name || artifact.path || artifact.url}
                      </span>
                      <RiExternalLinkLine className="h-3.5 w-3.5 ml-auto flex-shrink-0" />
                    </button>
                    {typeof artifact.url === 'string' && artifact.url.length > 0 && isImageArtifact(artifact as Record<string, unknown>) && (
                      <img
                        src={artifact.url}
                        alt={typeof artifact.name === 'string' ? artifact.name : 'artifact'}
                        className="max-h-48 w-full object-contain rounded border border-border/50 bg-background"
                      />
                    )}
                    {typeof artifact.url === 'string' && artifact.url.length > 0 && isVideoArtifact(artifact as Record<string, unknown>) && (
                      <video
                        src={artifact.url}
                        controls
                        className="max-h-56 w-full rounded border border-border/50 bg-background"
                      />
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No artifacts found.</div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="logs" className="flex-1 flex flex-col p-2">
          <ScrollArea className="flex-1">
            {currentTask.logs && currentTask.logs.length > 0 ? (
              <CodeBlock code={currentTask.logs.join('\n')} language="bash" className="h-full" />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No logs available.</div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RuntimeContextPanel;
