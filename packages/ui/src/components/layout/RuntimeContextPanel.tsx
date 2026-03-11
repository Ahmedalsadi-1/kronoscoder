import React from 'react';
import type { Message, Part } from '@kronoscode-ai/sdk/v2';
import {
  RiArrowLeftLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiFileList2Line,
  RiGlobalLine,
  RiLinkM,
  RiTerminalLine,
  RiErrorWarningLine,
} from '@remixicon/react';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';

const EMPTY_MESSAGES: Array<{ info: Message; parts: Part[] }> = [];

interface RuntimeContextPanelProps {
  directory: string;
  taskID: string | null;
}

type RuntimeTab = 'follow' | 'live' | 'files' | 'logs';
type FollowRecordKind = 'edit' | 'browse' | 'command';

type FollowRecord = {
  id: string;
  kind: FollowRecordKind;
  title: string;
  subtitle: string;
  tool: string;
  target: string | null;
  primaryPath: string | null;
  preview: string;
  timestamp: number | null;
  language: string;
};

const EDIT_TOOL_PATTERN =
  /(apply_patch|edit_file|write_file|move_file|create_or_update_file|push_files|update_file|replace_content|notion-update-page|gitlab_create_or_update_file|gitlab_push_files)/i;
const BROWSER_TOOL_PATTERN =
  /(browser|playwright|open_url|navigate|screenshot|browseros|desktop[-_]?browser|page-analysis|web-scraping|form-filling|webfetch|agentic-browser)/i;
const COMMAND_TOOL_PATTERN = /(exec_command|run_command|terminal)/i;

const normalizeOptionalString = (value: unknown): string | null => {
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

const truncateMiddle = (value: string, maxLength = 72): string => {
  if (value.length <= maxLength) {
    return value;
  }
  const head = Math.ceil((maxLength - 1) / 2);
  const tail = Math.floor((maxLength - 1) / 2);
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
};

const truncateBlock = (value: string, maxLength = 5000): string => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}\n…`;
};

const stringifyInputPreview = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return truncateBlock(JSON.stringify(value, null, 2));
  }
  if (value && typeof value === 'object') {
    try {
      return truncateBlock(JSON.stringify(value, null, 2));
    } catch {
      return '[unserializable input]';
    }
  }
  return String(value ?? '');
};

const readStringFromRecord = (record: Record<string, unknown> | null, keys: string[]): string | null => {
  if (!record) {
    return null;
  }
  for (const key of keys) {
    const value = normalizeOptionalString(record[key]);
    if (value) {
      return value;
    }
  }
  return null;
};

const collectPathsFromUnknown = (value: unknown, paths: Set<string>) => {
  const stringValue = normalizeOptionalString(value);
  if (stringValue) {
    paths.add(stringValue);
  }
};

const extractPatchPaths = (patch: string): string[] => {
  const paths = new Set<string>();
  const updateRegex = /^\*\*\* (?:Update|Add|Delete) File: (.+)$/gm;
  const moveRegex = /^\*\*\* Move to: (.+)$/gm;

  let match = updateRegex.exec(patch);
  while (match) {
    const filePath = normalizeOptionalString(match[1]);
    if (filePath) {
      paths.add(filePath);
    }
    match = updateRegex.exec(patch);
  }

  match = moveRegex.exec(patch);
  while (match) {
    const filePath = normalizeOptionalString(match[1]);
    if (filePath) {
      paths.add(filePath);
    }
    match = moveRegex.exec(patch);
  }

  return Array.from(paths);
};

const extractToolInput = (part: Part): unknown => {
  const partRecord = asRecord(part);
  const state = asRecord(partRecord?.state);
  return state?.input ?? partRecord?.input ?? null;
};

const extractRecordTimestamp = (message: Message, part: Part): number | null => {
  const messageRecord = asRecord(message);
  const partRecord = asRecord(part);
  const state = asRecord(partRecord?.state);
  const stateTime = asRecord(state?.time);
  const candidates = [
    stateTime?.end,
    stateTime?.start,
    messageRecord?.timeUpdated,
    messageRecord?.timeCreated,
    messageRecord?.createdAt,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate;
    }
  }
  return null;
};

const extractRecordPaths = (input: unknown): string[] => {
  const paths = new Set<string>();
  if (typeof input === 'string') {
    for (const patchPath of extractPatchPaths(input)) {
      paths.add(patchPath);
    }
    return Array.from(paths);
  }

  const record = asRecord(input);
  if (!record) {
    return [];
  }

  collectPathsFromUnknown(record.path, paths);
  collectPathsFromUnknown(record.file_path, paths);
  collectPathsFromUnknown(record.previous_path, paths);
  collectPathsFromUnknown(record.source, paths);
  collectPathsFromUnknown(record.destination, paths);

  const rawPaths = Array.isArray(record.paths) ? record.paths : [];
  for (const rawPath of rawPaths) {
    collectPathsFromUnknown(rawPath, paths);
  }

  const files = Array.isArray(record.files) ? record.files : [];
  for (const file of files) {
    const fileRecord = asRecord(file);
    collectPathsFromUnknown(fileRecord?.file_path, paths);
    collectPathsFromUnknown(fileRecord?.path, paths);
  }

  const actions = Array.isArray(record.actions) ? record.actions : [];
  for (const action of actions) {
    const actionRecord = asRecord(action);
    collectPathsFromUnknown(actionRecord?.file_path, paths);
    collectPathsFromUnknown(actionRecord?.previous_path, paths);
  }

  const edits = Array.isArray(record.edits) ? record.edits : [];
  for (const edit of edits) {
    const editRecord = asRecord(edit);
    collectPathsFromUnknown(editRecord?.path, paths);
    collectPathsFromUnknown(editRecord?.file_path, paths);
  }

  const patch = normalizeOptionalString(record.patch);
  if (patch) {
    for (const patchPath of extractPatchPaths(patch)) {
      paths.add(patchPath);
    }
  }

  return Array.from(paths);
};

const extractBrowseTarget = (input: unknown): string | null => {
  if (typeof input === 'string') {
    return normalizeOptionalString(input);
  }

  const record = asRecord(input);
  if (!record) {
    return null;
  }

  const directTarget = readStringFromRecord(record, [
    'url',
    'target',
    'destination',
    'query',
    'q',
    'selector',
    'path',
    'file_path',
    'searchTerm',
  ]);
  if (directTarget) {
    return directTarget;
  }

  const searchQuery = record.search_query;
  if (Array.isArray(searchQuery)) {
    for (const entry of searchQuery) {
      const entryRecord = asRecord(entry);
      const query = readStringFromRecord(entryRecord, ['q']);
      if (query) {
        return query;
      }
    }
  }

  return null;
};

const buildEditPreview = (tool: string, input: unknown): string => {
  if (typeof input === 'string') {
    return truncateBlock(input);
  }

  const record = asRecord(input);
  if (!record) {
    return stringifyInputPreview(input);
  }

  const patch = normalizeOptionalString(record.patch);
  if (patch) {
    return truncateBlock(patch);
  }

  const content = readStringFromRecord(record, ['content', 'newText', 'body']);
  if (content) {
    return truncateBlock(content);
  }

  const edits = Array.isArray(record.edits) ? record.edits : [];
  if (edits.length > 0) {
    const samples = edits.slice(0, 3).map((entry, index) => {
      const editRecord = asRecord(entry);
      const oldText = normalizeOptionalString(editRecord?.oldText);
      const newText = normalizeOptionalString(editRecord?.newText);
      return [
        `Edit ${index + 1}`,
        oldText ? `- ${truncateBlock(oldText, 160)}` : null,
        newText ? `+ ${truncateBlock(newText, 160)}` : null,
      ].filter((value): value is string => Boolean(value)).join('\n');
    });
    return samples.join('\n\n');
  }

  const files = Array.isArray(record.files) ? record.files : [];
  if (files.length > 0) {
    const snippets = files.slice(0, 2).map((entry) => {
      const fileRecord = asRecord(entry);
      const filePath = readStringFromRecord(fileRecord, ['file_path', 'path']) || 'file';
      const fileContent = readStringFromRecord(fileRecord, ['content']);
      return `${filePath}\n${truncateBlock(fileContent || '[no content captured]', 240)}`;
    });
    return snippets.join('\n\n');
  }

  const actions = Array.isArray(record.actions) ? record.actions : [];
  if (actions.length > 0) {
    return truncateBlock(JSON.stringify(actions, null, 2));
  }

  return truncateBlock(`${tool}\n${stringifyInputPreview(record)}`);
};

const inferLanguage = (record: FollowRecord): string => {
  if (record.kind === 'command') {
    return 'bash';
  }
  if (record.tool.includes('apply_patch')) {
    return 'diff';
  }
  const path = record.primaryPath || record.target || '';
  const extension = path.split('.').pop()?.toLowerCase() || '';
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'md', 'css', 'html', 'rs', 'go', 'py', 'sql', 'yaml', 'yml'].includes(extension)) {
    return extension;
  }
  return record.kind === 'browse' ? 'json' : 'text';
};

const buildFollowRecords = (messages: Array<{ info: Message; parts: Part[] }>): FollowRecord[] => {
  const records: FollowRecord[] = [];

  messages.forEach((entry) => {
    if (!entry || entry.info.role !== 'assistant') {
      return;
    }

    entry.parts.forEach((part, index) => {
      if (!part || part.type !== 'tool') {
        return;
      }

      const partRecord = asRecord(part);
      const tool = normalizeOptionalString(partRecord?.tool) || 'tool';
      const input = extractToolInput(part);
      const timestamp = extractRecordTimestamp(entry.info, part);

      if (EDIT_TOOL_PATTERN.test(tool)) {
        const paths = extractRecordPaths(input);
        const primaryPath = paths[0] ?? null;
        const pathLabel = primaryPath ? truncateMiddle(primaryPath, 64) : 'Inline patch';
        const preview = buildEditPreview(tool, input);
        const record: FollowRecord = {
          id: `${entry.info.id}:${index}:edit`,
          kind: 'edit',
          title: pathLabel,
          subtitle: paths.length > 1 ? `${paths.length} files updated` : 'File change captured',
          tool,
          target: primaryPath,
          primaryPath,
          preview,
          timestamp,
          language: 'text',
        };
        record.language = inferLanguage(record);
        records.push(record);
        return;
      }

      if (BROWSER_TOOL_PATTERN.test(tool)) {
        const target = extractBrowseTarget(input);
        const preview = buildEditPreview(tool, input);
        const record: FollowRecord = {
          id: `${entry.info.id}:${index}:browse`,
          kind: 'browse',
          title: target ? truncateMiddle(target, 68) : 'Browser action',
          subtitle: target ? 'Navigation or capture target' : 'Browser activity',
          tool,
          target,
          primaryPath: null,
          preview,
          timestamp,
          language: 'json',
        };
        record.language = inferLanguage(record);
        records.push(record);
        return;
      }

      if (COMMAND_TOOL_PATTERN.test(tool)) {
        const recordData = asRecord(input);
        const command = readStringFromRecord(recordData, ['cmd', 'command']) || stringifyInputPreview(input);
        const cwd = readStringFromRecord(recordData, ['workdir', 'cwd']) || 'Shell command';
        const record: FollowRecord = {
          id: `${entry.info.id}:${index}:command`,
          kind: 'command',
          title: truncateMiddle(cwd, 64),
          subtitle: truncateMiddle(command.split('\n')[0] || tool, 92),
          tool,
          target: cwd,
          primaryPath: null,
          preview: truncateBlock(command),
          timestamp,
          language: 'bash',
        };
        record.language = inferLanguage(record);
        records.push(record);
      }
    });
  });

  return records.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
};

const followIcon = (kind: FollowRecordKind) => {
  if (kind === 'browse') return RiGlobalLine;
  if (kind === 'command') return RiTerminalLine;
  return RiFileCopyLine;
};

const resolveRecordOpenPath = (directory: string, record: FollowRecord): string | null => {
  if (!record.primaryPath) {
    return null;
  }
  if (record.primaryPath.startsWith('/')) {
    return record.primaryPath;
  }
  if (!directory) {
    return record.primaryPath;
  }
  const normalizedDirectory = directory.replace(/\/+$/, '');
  return `${normalizedDirectory}/${record.primaryPath.replace(/^\/+/, '')}`;
};

export const RuntimeContextPanel: React.FC<RuntimeContextPanelProps> = ({ directory, taskID }) => {
  const currentSessionId = useSessionStore((state) => state.currentSessionId);
  const tasksByID = useAgentRuntimeStore((state) => state.tasksByID);
  const orderedTaskIDs = useAgentRuntimeStore((state) => state.orderedTaskIDs);
  const { closeContextPanel, openContextFile } = useUIStore();

  const currentTask = React.useMemo(() => {
    if (taskID && tasksByID[taskID]) {
      return tasksByID[taskID];
    }

    if (!currentSessionId) {
      return null;
    }

    const candidateTasks = orderedTaskIDs
      .map((candidateID) => tasksByID[candidateID])
      .filter((task): task is NonNullable<typeof task> => Boolean(task))
      .filter((task) => task.sessionID === currentSessionId);

    if (candidateTasks.length === 0) {
      return null;
    }

    return candidateTasks.reduce((latest, task) => (
      task.updatedAt > latest.updatedAt ? task : latest
    ), candidateTasks[0]);
  }, [currentSessionId, orderedTaskIDs, taskID, tasksByID]);

  const targetSessionID = currentTask?.sessionID ?? currentSessionId;

  const sessionMessages = useSessionStore(
    React.useCallback(
      (state) => (targetSessionID ? state.messages.get(targetSessionID) ?? EMPTY_MESSAGES : EMPTY_MESSAGES),
      [targetSessionID],
    ),
  );

  const followRecords = React.useMemo(
    () => buildFollowRecords(sessionMessages),
    [sessionMessages],
  );

  const [activeTab, setActiveTab] = React.useState<RuntimeTab>('follow');
  const [selectedRecordID, setSelectedRecordID] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!currentTask?.liveUrl && activeTab === 'live') {
      setActiveTab(followRecords.length > 0 ? 'follow' : 'logs');
    }
  }, [activeTab, currentTask?.liveUrl, followRecords.length]);

  React.useEffect(() => {
    if (selectedRecordID && followRecords.some((record) => record.id === selectedRecordID)) {
      return;
    }
    setSelectedRecordID(followRecords[0]?.id ?? null);
  }, [followRecords, selectedRecordID]);

  const selectedRecord = React.useMemo(
    () => followRecords.find((record) => record.id === selectedRecordID) ?? followRecords[0] ?? null,
    [followRecords, selectedRecordID],
  );

  const followSummary = React.useMemo(() => {
    return followRecords.reduce(
      (summary, record) => {
        if (record.kind === 'edit') summary.edits += 1;
        if (record.kind === 'browse') summary.browse += 1;
        if (record.kind === 'command') summary.commands += 1;
        return summary;
      },
      { edits: 0, browse: 0, commands: 0 },
    );
  }, [followRecords]);

  const handleOpenLiveUrl = React.useCallback(() => {
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

  const openArtifact = React.useCallback((artifact: Record<string, unknown>) => {
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

  const isImageArtifact = React.useCallback((artifact: Record<string, unknown>) => {
    const mimeType = typeof artifact.mimeType === 'string' ? artifact.mimeType.toLowerCase() : '';
    if (mimeType.startsWith('image/')) return true;
    const url = typeof artifact.url === 'string' ? artifact.url.toLowerCase() : '';
    return /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(url);
  }, []);

  const isVideoArtifact = React.useCallback((artifact: Record<string, unknown>) => {
    const mimeType = typeof artifact.mimeType === 'string' ? artifact.mimeType.toLowerCase() : '';
    if (mimeType.startsWith('video/')) return true;
    const url = typeof artifact.url === 'string' ? artifact.url.toLowerCase() : '';
    return /\.(mp4|mov|webm|m4v)$/.test(url);
  }, []);

  const handleOpenSelectedFile = React.useCallback(() => {
    if (!selectedRecord) {
      return;
    }
    const resolvedPath = resolveRecordOpenPath(directory, selectedRecord);
    if (!resolvedPath) {
      return;
    }
    openContextFile(directory, resolvedPath);
  }, [directory, openContextFile, selectedRecord]);

  const handleOpenSelectedTarget = React.useCallback(() => {
    const target = selectedRecord?.target;
    if (!target || !/^https?:\/\//i.test(target)) {
      return;
    }
    void openUrlInAppBrowser({
      url: target,
      sessionID: currentTask?.sessionID ?? currentSessionId,
      directory,
    }).then((opened) => {
      if (!opened) {
        toast.info('Switched to in-app browser. Select an active session to navigate.');
      }
    });
  }, [currentSessionId, currentTask?.sessionID, directory, selectedRecord?.target]);

  if (!currentTask && !targetSessionID) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-muted-foreground">
        <RiErrorWarningLine className="h-10 w-10 mb-2" />
        <p>No runtime task is available for this panel yet.</p>
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
        <span className="text-sm font-medium truncate">
          {currentTask?.agentName || 'Follow agent work'}
        </span>
        <div className="flex items-center gap-1">
          {currentTask?.liveUrl ? (
            <Button variant="ghost" size="sm" onClick={handleOpenLiveUrl} title="Open live browser">
              <RiExternalLinkLine className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as RuntimeTab)} className="flex-1 flex flex-col min-h-0">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="follow">Follow</TabsTrigger>
          <TabsTrigger value="live" disabled={!currentTask?.liveUrl}>Live</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        <Separator />

        <TabsContent value="follow" className="flex-1 min-h-0 p-0">
          {followRecords.length > 0 ? (
            <div className="grid h-full min-h-0 grid-cols-[240px_minmax(0,1fr)]">
              <div className="flex min-h-0 flex-col border-r border-border/60 bg-muted/10">
                <div className="border-b border-border/60 px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Follow agent work
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    <span className="rounded-full border border-border/60 px-2 py-1">Edits {followSummary.edits}</span>
                    <span className="rounded-full border border-border/60 px-2 py-1">Browser {followSummary.browse}</span>
                    <span className="rounded-full border border-border/60 px-2 py-1">Shell {followSummary.commands}</span>
                  </div>
                </div>
                <ScrollArea className="flex-1">
                  <div className="space-y-1 p-2">
                    {followRecords.map((record) => {
                      const Icon = followIcon(record.kind);
                      const isSelected = selectedRecord?.id === record.id;
                      return (
                        <button
                          key={record.id}
                          type="button"
                          onClick={() => setSelectedRecordID(record.id)}
                          className={cn(
                            'w-full rounded-xl border px-3 py-2 text-left transition-colors',
                            isSelected
                              ? 'border-primary/40 bg-primary/10'
                              : 'border-border/60 bg-background/70 hover:border-primary/25 hover:bg-background',
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 rounded-lg border border-border/60 bg-card/80 p-1.5">
                              <Icon className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-foreground">{record.title}</div>
                              <div className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                                {record.subtitle}
                              </div>
                              <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
                                {record.tool}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              <div className="flex min-h-0 flex-col">
                {selectedRecord ? (
                  <>
                    <div className="border-b border-border/60 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold text-foreground">
                            {selectedRecord.title}
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {selectedRecord.subtitle}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                            <span className="rounded-full border border-border/60 px-2 py-1">{selectedRecord.tool}</span>
                            {selectedRecord.timestamp ? (
                              <span className="rounded-full border border-border/60 px-2 py-1">
                                {format(selectedRecord.timestamp, 'MMM d, HH:mm:ss')}
                              </span>
                            ) : null}
                            {selectedRecord.target ? (
                              <span className="rounded-full border border-border/60 px-2 py-1" title={selectedRecord.target}>
                                {truncateMiddle(selectedRecord.target, 64)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {selectedRecord.primaryPath ? (
                            <Button type="button" size="sm" variant="outline" className="gap-2" onClick={handleOpenSelectedFile}>
                              <RiFileList2Line className="h-3.5 w-3.5" />
                              Open file
                            </Button>
                          ) : null}
                          {selectedRecord.kind === 'browse' && selectedRecord.target && /^https?:\/\//i.test(selectedRecord.target) ? (
                            <Button type="button" size="sm" variant="outline" className="gap-2" onClick={handleOpenSelectedTarget}>
                              <RiLinkM className="h-3.5 w-3.5" />
                              Open target
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="space-y-4 p-4">
                        <div className="rounded-2xl border border-border/60 bg-card/40 p-3">
                          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                            Captured input
                          </div>
                          <CodeBlock code={selectedRecord.preview || 'No captured preview.'} language={selectedRecord.language} className="mt-3 max-h-[520px]" />
                        </div>

                        {currentTask ? (
                          <div className="rounded-2xl border border-border/60 bg-background/65 p-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                              Runtime context
                            </div>
                            <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                              <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-2">
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Mode</div>
                                <div className="mt-1 text-foreground">{currentTask.requestedMode ?? currentTask.mode}</div>
                              </div>
                              <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-2">
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</div>
                                <div className="mt-1 text-foreground">{currentTask.status}</div>
                              </div>
                              <div className="rounded-xl border border-border/50 bg-card/40 px-3 py-2 md:col-span-2">
                                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Prompt</div>
                                <div className="mt-1 text-foreground">{currentTask.prompt || 'Runtime task'}</div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </ScrollArea>
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    No captured activity yet.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-muted-foreground">
              No captured edits or browser steps yet. As tool calls arrive, this panel will show files, commands, and browser targets in sequence.
            </div>
          )}
        </TabsContent>

        <TabsContent value="live" className="flex-1 p-2">
          {currentTask?.liveUrl ? (
            <iframe src={currentTask.liveUrl} className="w-full h-full border-none rounded-md" />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">No live URL available.</div>
          )}
        </TabsContent>

        <TabsContent value="files" className="flex-1 p-2">
          <ScrollArea className="h-full">
            {currentTask?.artifacts && currentTask.artifacts.length > 0 ? (
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
            {currentTask?.logs && currentTask.logs.length > 0 ? (
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
