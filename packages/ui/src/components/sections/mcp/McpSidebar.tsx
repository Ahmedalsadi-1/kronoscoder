import React from 'react';
import { Button } from '@/components/ui/button';
import { ButtonLarge } from '@/components/ui/button-large';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RiAddLine, RiDeleteBinLine, RiFileTextLine, RiMore2Line, RiPlugLine, RiServerLine, RiSparklingLine } from '@remixicon/react';
import {
  useMcpConfigStore,
  type McpDraft,
  type McpDraftSourceKind,
  type McpScope,
  type McpServerConfig,
} from '@/stores/useMcpConfigStore';
import { useMcpStore } from '@/stores/useMcpStore';
import { useDirectoryStore } from '@/stores/useDirectoryStore';
import { useUIStore } from '@/stores/useUIStore';
import { isVSCodeRuntime } from '@/lib/desktop';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui';
import { ScrollableOverlay } from '@/components/ui/ScrollableOverlay';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';

interface McpSidebarProps {
  onItemSelect?: () => void;
}

type OpenfangHandTemplate = {
  id: string;
  name: string;
  description?: string;
  tools?: string[];
  requirements?: string[];
  promptBody?: string;
  commandTemplate?: string;
};

// ---- Status dot ----
type StatusTone = 'success' | 'error' | 'warning' | 'idle';

const statusToneFromMcp = (status: string | undefined): StatusTone => {
  switch (status) {
    case 'connected': return 'success';
    case 'failed': return 'error';
    case 'needs_auth':
    case 'needs_client_registration': return 'warning';
    default: return 'idle';
  }
};

const StatusDot: React.FC<{ tone: StatusTone; enabled: boolean }> = ({ tone, enabled }) => {
  if (!enabled) {
    return (
      <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/30 flex-shrink-0" />
    );
  }
  const classes: Record<StatusTone, string> = {
    success: 'bg-green-500',
    error: 'bg-destructive',
    warning: 'bg-yellow-500',
    idle: 'bg-muted-foreground/40',
  };
  return (
    <span className={cn('inline-block h-2 w-2 rounded-full flex-shrink-0', classes[tone])} />
  );
};

export const McpSidebar: React.FC<McpSidebarProps> = ({ onItemSelect }) => {
  const isVSCode = React.useMemo(() => isVSCodeRuntime(), []);
  const bgClass = isVSCode ? 'bg-background' : 'bg-sidebar';

  const {
    mcpServers,
    mcpPresets,
    selectedMcpName,
    setSelectedMcp,
    setMcpDraft,
    loadMcpConfigs,
    loadMcpPresets,
    createDraftFromPreset,
    createDraftFromSource,
    deleteMcp,
  } =
    useMcpConfigStore();

  const currentDirectory = useDirectoryStore((state) => state.currentDirectory);
  const mcpStatus = useMcpStore((state) => state.getStatusForDirectory(currentDirectory ?? null));
  const openMultiRunLauncherWithPrompt = useUIStore((state) => state.openMultiRunLauncherWithPrompt);

  const [deleteTarget, setDeleteTarget] = React.useState<McpServerConfig | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [presetDialogOpen, setPresetDialogOpen] = React.useState(false);
  const [selectedPresetID, setSelectedPresetID] = React.useState<string>('');
  const [presetScope, setPresetScope] = React.useState<McpScope>('user');
  const [handDialogOpen, setHandDialogOpen] = React.useState(false);
  const [selectedHandTemplateID, setSelectedHandTemplateID] = React.useState<string>('');
  const [handTemplates, setHandTemplates] = React.useState<OpenfangHandTemplate[]>([]);
  const [installDialogOpen, setInstallDialogOpen] = React.useState(false);
  const [installScope, setInstallScope] = React.useState<McpScope>('user');
  const [installSourceType, setInstallSourceType] = React.useState<McpDraftSourceKind>('github');
  const [installSourceValue, setInstallSourceValue] = React.useState('');

  React.useEffect(() => {
    void loadMcpConfigs();
  }, [loadMcpConfigs]);

  const handleCreateNew = () => {
    const baseName = 'new-mcp-server';
    let newName = baseName;
    let counter = 1;
    while (mcpServers.some((s) => s.name === newName)) {
      newName = `${baseName}-${counter}`;
      counter++;
    }

    const draft: McpDraft = {
      name: newName,
      scope: 'user',
      type: 'local',
      command: [],
      url: '',
      environment: [],
      enabled: true,
    };
    setMcpDraft(draft);
    setSelectedMcp(newName);
    onItemSelect?.();
  };

  const handleOpenPresetDialog = React.useCallback(async () => {
    const presets = await loadMcpPresets();
    if (presets.length === 0) {
      toast.error('No MCP presets available');
      return;
    }
    setSelectedPresetID((prev) => prev || presets[0].id);
    setPresetDialogOpen(true);
  }, [loadMcpPresets]);

  const handleCreateFromPreset = React.useCallback(() => {
    if (!selectedPresetID) {
      toast.error('Select a preset first');
      return;
    }
    const draft = createDraftFromPreset(selectedPresetID, presetScope);
    if (!draft) {
      toast.error('Preset not found');
      return;
    }
    setMcpDraft(draft);
    setSelectedMcp(draft.name);
    setPresetDialogOpen(false);
    onItemSelect?.();
  }, [createDraftFromPreset, onItemSelect, presetScope, selectedPresetID, setMcpDraft, setSelectedMcp]);

  const handleCreateFromSource = React.useCallback(() => {
    const draft = createDraftFromSource(installSourceValue, installSourceType, installScope);
    if (!draft) {
      toast.error('Enter a valid package, repo, URL, or command');
      return;
    }
    setMcpDraft(draft);
    setSelectedMcp(draft.name);
    setInstallDialogOpen(false);
    setInstallSourceValue('');
    onItemSelect?.();
  }, [
    createDraftFromSource,
    installScope,
    installSourceType,
    installSourceValue,
    onItemSelect,
    setMcpDraft,
    setSelectedMcp,
  ]);

  const loadHandTemplates = React.useCallback(async () => {
    const response = await fetch('/api/config/hands/templates', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error('Failed to load hand templates');
    }
    const payload = (await response.json().catch(() => null)) as null | { templates?: OpenfangHandTemplate[] };
    return Array.isArray(payload?.templates) ? payload.templates : [];
  }, []);

  const handleOpenHandDialog = React.useCallback(async () => {
    try {
      const templates = await loadHandTemplates();
      if (templates.length === 0) {
        toast.error('No OpenFang Hand templates available');
        return;
      }
      setHandTemplates(templates);
      setSelectedHandTemplateID((prev) => prev || templates[0].id);
      setHandDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load Hand templates');
    }
  }, [loadHandTemplates]);

  const handleCreateTaskFromHand = React.useCallback(() => {
    if (!selectedHandTemplateID) {
      toast.error('Select a hand template first');
      return;
    }
    const template = handTemplates.find((item) => item.id === selectedHandTemplateID);
    if (!template) {
      toast.error('Selected template not found');
      return;
    }

    const tools = Array.isArray(template.tools) && template.tools.length > 0
      ? `Tools: ${template.tools.join(', ')}`
      : '';
    const requirements = Array.isArray(template.requirements) && template.requirements.length > 0
      ? `Requirements: ${template.requirements.join(', ')}`
      : '';
    const commandTemplate = typeof template.commandTemplate === 'string' && template.commandTemplate.trim().length > 0
      ? `Command template: ${template.commandTemplate.trim()}`
      : '';
    const promptBody = typeof template.promptBody === 'string' && template.promptBody.trim().length > 0
      ? template.promptBody.trim()
      : '';

    const prefillPrompt = [
      `Create task from OpenFang Hand template "${template.name}".`,
      template.description || '',
      tools,
      requirements,
      commandTemplate,
      promptBody ? `\nTemplate prompt body:\n${promptBody}` : '',
    ]
      .filter((line) => line.length > 0)
      .join('\n');

    openMultiRunLauncherWithPrompt(prefillPrompt, {
      source: 'openfang-hand-template',
      tags: ['openfang', 'hand-template', template.id],
      paths: currentDirectory ? [currentDirectory] : undefined,
    });
    setHandDialogOpen(false);
    onItemSelect?.();
    toast.success(`Opened Hand template "${template.name}" in Multi-Run launcher`);
  }, [currentDirectory, handTemplates, onItemSelect, openMultiRunLauncherWithPrompt, selectedHandTemplateID]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const success = await deleteMcp(deleteTarget.name);
    if (success) {
      toast.success(`MCP server "${deleteTarget.name}" deleted`);
    } else {
      toast.error('Failed to delete MCP server');
    }
    setDeleteTarget(null);
    setIsDeleting(false);
  };

  return (
    <div className={cn('flex h-full flex-col', bgClass)}>
      {/* Header */}
      <div className="border-b px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="typography-meta text-muted-foreground">
            {mcpServers.length} server{mcpServers.length !== 1 ? 's' : ''}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 -my-1 text-muted-foreground"
                title="Add MCP server"
              >
                <RiAddLine className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={handleCreateNew}>
                <RiAddLine className="h-4 w-4 mr-px" />
                Add blank server
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { void handleOpenPresetDialog(); }}>
                <RiSparklingLine className="h-4 w-4 mr-px" />
                Create from preset
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setInstallDialogOpen(true)}>
                <RiPlugLine className="h-4 w-4 mr-px" />
                Install from package/repo
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { void handleOpenHandDialog(); }}>
                <RiFileTextLine className="h-4 w-4 mr-px" />
                Create task from Hand template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* List */}
      <ScrollableOverlay outerClassName="flex-1 min-h-0" className="space-y-1 px-3 py-2 overflow-x-hidden">
        {mcpServers.length === 0 ? (
          <div className="py-12 px-4 text-center text-muted-foreground">
            <RiPlugLine className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p className="typography-ui-label font-medium">No MCP servers configured</p>
            <p className="typography-meta mt-1 opacity-75">Use the + button above to add one</p>
          </div>
        ) : (
          mcpServers.map((server) => {
            const runtimeStatus = mcpStatus[server.name];
            const tone = statusToneFromMcp(runtimeStatus?.status);
            const isSelected = selectedMcpName === server.name;

            return (
              <div
                key={server.name}
                className={cn(
                  'group relative flex items-center rounded-md px-1.5 py-1 transition-all duration-200',
                  isSelected ? 'bg-interactive-selection' : 'hover:bg-interactive-hover',
                )}
              >
                <button
                  onClick={() => {
                    setSelectedMcp(server.name);
                    setMcpDraft(null);
                    onItemSelect?.();
                  }}
                  className="flex min-w-0 flex-1 flex-col gap-0 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <div className="flex items-center gap-2">
                    <StatusDot tone={tone} enabled={server.enabled} />
                    <span className="typography-ui-label font-normal truncate text-foreground">
                      {server.name}
                    </span>
                    <span className="typography-micro text-muted-foreground bg-muted px-1 rounded flex-shrink-0 leading-none pb-px border border-border/50">
                      {server.type}
                    </span>
                    {!server.enabled && (
                      <span className="typography-micro text-muted-foreground/60 flex-shrink-0">
                        off
                      </span>
                    )}
                  </div>
                  <div className="typography-micro text-muted-foreground/60 truncate leading-tight pl-4">
                    {server.type === 'local'
                      ? (server as { command?: string[] }).command?.join(' ') ?? ''
                      : (server as { url?: string }).url ?? ''}
                  </div>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 flex-shrink-0 -mr-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                    >
                      <RiMore2Line className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-fit min-w-20">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(server);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <RiDeleteBinLine className="h-4 w-4 mr-px" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })
        )}
      </ScrollableOverlay>

      {/* Delete confirm dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete MCP Server</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This will remove it from{' '}
              <code className="text-foreground">kronoscode.json</code>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
              className="text-foreground hover:bg-interactive-hover hover:text-foreground"
            >
              Cancel
            </Button>
            <ButtonLarge onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </ButtonLarge>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create MCP From Preset</DialogTitle>
            <DialogDescription>
              Start from an OpenFang preset and adjust fields on the details page before saving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={selectedPresetID} onValueChange={setSelectedPresetID}>
              <SelectTrigger className="!h-9 w-full">
                {selectedPresetID || 'Select preset'}
              </SelectTrigger>
              <SelectContent>
                {mcpPresets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id} className="pr-2 [&>span:first-child]:hidden">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span>{preset.name}</span>
                        <span className="typography-micro text-muted-foreground">{preset.transport}</span>
                      </div>
                      <span className="typography-micro text-muted-foreground">{preset.description || preset.id}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={presetScope} onValueChange={(value) => setPresetScope(value as McpScope)}>
              <SelectTrigger className="!h-9 w-full">
                Scope: {presetScope}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="project">Project</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-foreground hover:bg-interactive-hover hover:text-foreground"
              onClick={() => setPresetDialogOpen(false)}
            >
              Cancel
            </Button>
            <ButtonLarge onClick={handleCreateFromPreset}>
              Use preset
            </ButtonLarge>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Install MCP From Package or Repo</DialogTitle>
            <DialogDescription>
              Create a draft from an npm package, GitHub repo, PyPI package, remote URL, or a raw command. Review the generated command on the details page before saving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={installSourceType} onValueChange={(value) => setInstallSourceType(value as McpDraftSourceKind)}>
              <SelectTrigger className="!h-9 w-full">
                Source: {installSourceType}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="github">GitHub repo</SelectItem>
                <SelectItem value="npm">npm package</SelectItem>
                <SelectItem value="pypi">PyPI package</SelectItem>
                <SelectItem value="remote">Remote MCP URL</SelectItem>
                <SelectItem value="command">Raw command</SelectItem>
              </SelectContent>
            </Select>

            <Select value={installScope} onValueChange={(value) => setInstallScope(value as McpScope)}>
              <SelectTrigger className="!h-9 w-full">
                Scope: {installScope}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="project">Project</SelectItem>
              </SelectContent>
            </Select>

            <div className="space-y-2">
              <Input
                value={installSourceValue}
                onChange={(event) => setInstallSourceValue(event.target.value)}
                placeholder={installSourcePlaceholder(installSourceType)}
              />
              <p className="typography-micro text-muted-foreground">
                {installSourceHint(installSourceType)}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-foreground hover:bg-interactive-hover hover:text-foreground"
              onClick={() => setInstallDialogOpen(false)}
            >
              Cancel
            </Button>
            <ButtonLarge onClick={handleCreateFromSource}>
              Create draft
            </ButtonLarge>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={handDialogOpen} onOpenChange={setHandDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Task From Hand Template</DialogTitle>
            <DialogDescription>
              Select an OpenFang Hand template and prefill the existing Multi-Run creation flow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={selectedHandTemplateID} onValueChange={setSelectedHandTemplateID}>
              <SelectTrigger className="!h-9 w-full">
                {selectedHandTemplateID || 'Select hand template'}
              </SelectTrigger>
              <SelectContent>
                {handTemplates.map((template) => (
                  <SelectItem key={template.id} value={template.id} className="pr-2 [&>span:first-child]:hidden">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span>{template.name}</span>
                      </div>
                      <span className="typography-micro text-muted-foreground">{template.description || template.id}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-foreground hover:bg-interactive-hover hover:text-foreground"
              onClick={() => setHandDialogOpen(false)}
            >
              Cancel
            </Button>
            <ButtonLarge onClick={handleCreateTaskFromHand}>
              Use template
            </ButtonLarge>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Re-export for easy sidebar icon usage
export { RiServerLine as McpIcon };

const installSourcePlaceholder = (kind: McpDraftSourceKind): string => {
  if (kind === 'npm') return '@scope/server-name or server-name';
  if (kind === 'pypi') return 'mcp2cli or package-name';
  if (kind === 'remote') return 'https://example.com/mcp';
  if (kind === 'command') return 'uvx mcp2cli --help';
  return 'owner/repo or https://github.com/owner/repo';
};

const installSourceHint = (kind: McpDraftSourceKind): string => {
  if (kind === 'npm') return 'Creates an stdio command draft with `npx -y <package>`.';
  if (kind === 'pypi') return 'Creates an stdio command draft with `uvx <package>` for Python-hosted MCP servers such as `mcp2cli`.';
  if (kind === 'remote') return 'Creates a remote MCP draft and leaves credentials/env for the details page.';
  if (kind === 'command') return 'Parses a raw shell command into argv so you can start from an exact launcher.';
  return 'Creates an stdio command draft with `npx -y github:<owner>/<repo>` when possible. Good for repo-first experiments such as `ghostwright/ghost-os` or `HKUDS/CLI-Anything`, then adjust the generated command before saving.';
};
