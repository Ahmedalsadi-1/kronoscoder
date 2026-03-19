import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import { getSafeStorage } from './utils/safeStorage';
import {
  startConfigUpdate,
  finishConfigUpdate,
} from '@/lib/configUpdate';
import { refreshAfterKronosCodeRestart } from '@/stores/useAgentsStore';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { kronoscodeClient } from '@/lib/kronoscode/client';

export type McpScope = 'user' | 'project';

const getConfigDirectory = (): string | null => {
  try {
    const projectsStore = useProjectsStore.getState();
    const activeProject = projectsStore.getActiveProject?.();
    if (activeProject?.path?.trim()) {
      return activeProject.path.trim();
    }

    const clientDir = kronoscodeClient.getDirectory();
    if (clientDir?.trim()) {
      return clientDir.trim();
    }
  } catch (err) {
    console.warn('[McpConfigStore] Error resolving config directory:', err);
  }
  return null;
};

// ============== TYPES ==============

export interface McpLocalConfig {
  type: 'local';
  command: string[];
  environment?: Record<string, string>;
  enabled: boolean;
}

export interface McpRemoteConfig {
  type: 'remote';
  url: string;
  environment?: Record<string, string>;
  enabled: boolean;
}

export type McpServerConfig = (McpLocalConfig | McpRemoteConfig) & { name: string };
export type McpServerWithScope = McpServerConfig & { scope?: McpScope | null };

export interface McpPresetEnvVar {
  name: string;
  label?: string;
  help?: string;
  isSecret?: boolean;
  getUrl?: string;
}

export interface McpPreset {
  id: string;
  name: string;
  description: string;
  transport: 'stdio' | 'remote';
  command?: string;
  url?: string;
  args: string[];
  requiredEnv: McpPresetEnvVar[];
  oauth?: Record<string, unknown> | null;
  tags: string[];
  setupInstructions: string;
  source?: string;
}

export interface McpDraft {
  name: string;
  scope: McpScope;
  type: 'local' | 'remote';
  command: string[];
  url: string;
  environment: Array<{ key: string; value: string }>;
  enabled: boolean;
}

export type McpDraftSourceKind = 'npm' | 'github' | 'pypi' | 'remote' | 'command';

// ============== HELPERS ==============

export const envRecordToArray = (env?: Record<string, string>): Array<{ key: string; value: string }> => {
  if (!env) return [];
  return Object.entries(env).map(([key, value]) => ({ key, value }));
};

export const envArrayToRecord = (arr: Array<{ key: string; value: string }>): Record<string, string> | undefined => {
  const filtered = arr.filter((e) => e.key.trim());
  if (filtered.length === 0) return undefined;
  return Object.fromEntries(filtered.map((e) => [e.key.trim(), e.value]));
};

const CLIENT_RELOAD_DELAY_MS = 800;

// ============== STORE ==============

interface McpConfigStore {
  mcpServers: McpServerWithScope[];
  mcpPresets: McpPreset[];
  isLoadingPresets: boolean;
  selectedMcpName: string | null;
  isLoading: boolean;
  mcpDraft: McpDraft | null;

  setSelectedMcp: (name: string | null) => void;
  setMcpDraft: (draft: McpDraft | null) => void;
  loadMcpConfigs: () => Promise<boolean>;
  loadMcpPresets: () => Promise<McpPreset[]>;
  createDraftFromPreset: (presetId: string, scope?: McpScope) => McpDraft | null;
  createDraftFromSource: (source: string, kind: McpDraftSourceKind, scope?: McpScope) => McpDraft | null;
  createMcp: (config: McpDraft) => Promise<boolean>;
  updateMcp: (name: string, config: Partial<McpDraft>) => Promise<boolean>;
  deleteMcp: (name: string) => Promise<boolean>;
  getMcpByName: (name: string) => McpServerWithScope | undefined;
}

export const useMcpConfigStore = create<McpConfigStore>()(
  devtools(
    persist(
      (set, get) => ({
        mcpServers: [],
        mcpPresets: [],
        isLoadingPresets: false,
        selectedMcpName: null,
        isLoading: false,
        mcpDraft: null,

        setSelectedMcp: (name) => set({ selectedMcpName: name }),

        setMcpDraft: (draft) => set({ mcpDraft: draft }),

        loadMcpConfigs: async () => {
          set({ isLoading: true });
          try {
            const configDirectory = getConfigDirectory();
            const queryParams = configDirectory ? `?directory=${encodeURIComponent(configDirectory)}` : '';
            const response = await fetch(`/api/config/mcp${queryParams}`, {
              headers: configDirectory ? { 'x-kronoscode-directory': configDirectory } : undefined,
            });
            if (!response.ok) {
              throw new Error('Failed to load MCP configs');
            }
            const data: McpServerWithScope[] = await response.json();
            set({ mcpServers: data, isLoading: false });
            return true;
          } catch (error) {
            console.error('[McpConfigStore] Failed to load MCP configs:', error);
            set({ isLoading: false });
            return false;
          }
        },

        loadMcpPresets: async () => {
          set({ isLoadingPresets: true });
          try {
            const response = await fetch('/api/config/mcp/presets', {
              headers: { Accept: 'application/json' },
            });
            if (!response.ok) {
              throw new Error('Failed to load MCP presets');
            }
            const payload = await response.json().catch(() => null) as null | { presets?: McpPreset[] };
            const presets = Array.isArray(payload?.presets) ? payload.presets : [];
            set({ mcpPresets: presets, isLoadingPresets: false });
            return presets;
          } catch (error) {
            console.error('[McpConfigStore] Failed to load MCP presets:', error);
            set({ isLoadingPresets: false });
            return [];
          }
        },

        createDraftFromPreset: (presetId: string, scope: McpScope = 'user') => {
          const preset = get().mcpPresets.find((item) => item.id === presetId);
          if (!preset) {
            return null;
          }

          const existingNames = new Set(get().mcpServers.map((item) => item.name));
          const baseName = preset.id.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
          let name = baseName;
          let idx = 1;
          while (existingNames.has(name)) {
            name = `${baseName}-${idx}`;
            idx += 1;
          }

          const environment = preset.requiredEnv.map((item) => ({
            key: item.name,
            value: '',
          }));

          return {
            name,
            scope,
            type: preset.transport === 'remote' ? 'remote' : 'local',
            command: preset.transport === 'stdio'
              ? [preset.command ?? '', ...preset.args].filter((entry) => entry.trim().length > 0)
              : [],
            url: preset.transport === 'remote' ? (preset.url ?? '') : '',
            environment,
            enabled: true,
          };
        },

        createDraftFromSource: (source: string, kind: McpDraftSourceKind, scope: McpScope = 'user') => {
          const trimmed = source.trim();
          if (!trimmed) {
            return null;
          }

          const existingNames = new Set(get().mcpServers.map((item) => item.name));
          const baseName = buildDraftNameFromSource(trimmed, kind);
          let name = baseName;
          let idx = 1;
          while (existingNames.has(name)) {
            name = `${baseName}-${idx}`;
            idx += 1;
          }

          if (kind === 'remote') {
            return {
              name,
              scope,
              type: 'remote',
              command: [],
              url: trimmed,
              environment: [],
              enabled: true,
            };
          }

          return {
            name,
            scope,
            type: 'local',
            command: buildCommandFromSource(trimmed, kind),
            url: '',
            environment: [],
            enabled: true,
          };
        },

        createMcp: async (config: McpDraft) => {
          startConfigUpdate('Creating MCP server configuration…');
          let requiresReload = false;
          try {
            const body = buildMcpBody(config);
            const configDirectory = getConfigDirectory();
            const queryParams = configDirectory ? `?directory=${encodeURIComponent(configDirectory)}` : '';
            const response = await fetch(`/api/config/mcp/${encodeURIComponent(config.name)}${queryParams}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(configDirectory ? { 'x-kronoscode-directory': configDirectory } : {}),
              },
              body: JSON.stringify(body),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
              throw new Error(payload?.error || 'Failed to create MCP server');
            }

            if (payload?.requiresReload) {
              requiresReload = true;
              await refreshAfterKronosCodeRestart({
                message: payload.message,
                delayMs: payload.reloadDelayMs ?? CLIENT_RELOAD_DELAY_MS,
                scopes: ['all'],
              });
              return true;
            }

            await get().loadMcpConfigs();
            return true;
          } catch (error) {
            console.error('[McpConfigStore] Failed to create MCP:', error);
            return false;
          } finally {
            if (!requiresReload) finishConfigUpdate();
          }
        },

        updateMcp: async (name: string, config: Partial<McpDraft>) => {
          startConfigUpdate('Updating MCP server configuration…');
          let requiresReload = false;
          try {
            const body = buildMcpBody(config);
            const configDirectory = getConfigDirectory();
            const queryParams = configDirectory ? `?directory=${encodeURIComponent(configDirectory)}` : '';
            const response = await fetch(`/api/config/mcp/${encodeURIComponent(name)}${queryParams}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                ...(configDirectory ? { 'x-kronoscode-directory': configDirectory } : {}),
              },
              body: JSON.stringify(body),
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
              throw new Error(payload?.error || 'Failed to update MCP server');
            }

            if (payload?.requiresReload) {
              requiresReload = true;
              await refreshAfterKronosCodeRestart({
                message: payload.message,
                delayMs: payload.reloadDelayMs ?? CLIENT_RELOAD_DELAY_MS,
                scopes: ['all'],
              });
              return true;
            }

            await get().loadMcpConfigs();
            return true;
          } catch (error) {
            console.error('[McpConfigStore] Failed to update MCP:', error);
            throw error;
          } finally {
            if (!requiresReload) finishConfigUpdate();
          }
        },

        deleteMcp: async (name: string) => {
          startConfigUpdate('Deleting MCP server configuration…');
          let requiresReload = false;
          try {
            const configDirectory = getConfigDirectory();
            const queryParams = configDirectory ? `?directory=${encodeURIComponent(configDirectory)}` : '';
            const response = await fetch(`/api/config/mcp/${encodeURIComponent(name)}${queryParams}`, {
              method: 'DELETE',
              headers: configDirectory ? { 'x-kronoscode-directory': configDirectory } : undefined,
            });

            const payload = await response.json().catch(() => null);
            if (!response.ok) {
              throw new Error(payload?.error || 'Failed to delete MCP server');
            }

            if (payload?.requiresReload) {
              requiresReload = true;
              await refreshAfterKronosCodeRestart({
                message: payload.message,
                delayMs: payload.reloadDelayMs ?? CLIENT_RELOAD_DELAY_MS,
                scopes: ['all'],
              });
              return true;
            }

            if (get().selectedMcpName === name) {
              set({ selectedMcpName: null });
            }
            await get().loadMcpConfigs();
            return true;
          } catch (error) {
            console.error('[McpConfigStore] Failed to delete MCP:', error);
            return false;
          } finally {
            if (!requiresReload) finishConfigUpdate();
          }
        },

        getMcpByName: (name: string) => {
          return get().mcpServers.find((s) => s.name === name);
        },
      }),
      {
        name: 'mcp-config-store',
        storage: createJSONStorage(() => getSafeStorage()),
        partialize: (state) => ({ selectedMcpName: state.selectedMcpName }),
      },
    ),
    { name: 'mcp-config-store' },
  ),
);

// ============== HELPERS ==============

function buildMcpBody(config: Partial<McpDraft>): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (config.scope !== undefined) body.scope = config.scope;

  if (config.type !== undefined) body.type = config.type;

  if (config.type === 'local' || config.command !== undefined) {
    body.command = (config.command ?? []).filter((s) => s.trim());
  }

  if (config.type === 'remote' || config.url !== undefined) {
    body.url = config.url?.trim() ?? '';
  }

  if (config.environment !== undefined) {
    body.environment = envArrayToRecord(config.environment) ?? {};
  }

  if (config.enabled !== undefined) {
    body.enabled = config.enabled;
  }

  return body;
}

function buildDraftNameFromSource(source: string, kind: McpDraftSourceKind): string {
  const normalized = source.trim();
  const fallback = kind === 'remote' ? 'remote-mcp-server' : 'new-mcp-server';

  if (!normalized) {
    return fallback;
  }

  const repoLike = normalized
    .replace(/^github:/i, '')
    .replace(/^npm:/i, '')
    .replace(/^pypi:/i, '')
    .replace(/\.git$/i, '')
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/[?#].*$/, '')
    .split('/')
    .filter(Boolean)
    .pop();

  const shellLike = kind === 'command' ? parseShellCommand(normalized)[0] : repoLike;
  const candidate = (shellLike || repoLike || normalized)
    .replace(/^@/, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return candidate || fallback;
}

function buildCommandFromSource(source: string, kind: McpDraftSourceKind): string[] {
  if (kind === 'command') {
    return parseShellCommand(source);
  }
  if (kind === 'pypi') {
    const pkg = source.replace(/^pypi:/i, '').trim();
    return ['uvx', pkg];
  }
  if (kind === 'github') {
    const repo = normalizeGithubSource(source);
    return ['npx', '-y', repo];
  }
  const pkg = source.replace(/^npm:/i, '').trim();
  return ['npx', '-y', pkg];
}

function normalizeGithubSource(source: string): string {
  const trimmed = source.trim().replace(/\.git$/i, '');
  if (/^github:/i.test(trimmed)) {
    return trimmed;
  }

  const urlMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+\/[^/#?]+)/i);
  if (urlMatch?.[1]) {
    return `github:${urlMatch[1]}`;
  }

  const repoMatch = trimmed.match(/^[^/\s]+\/[^/\s]+$/);
  if (repoMatch) {
    return `github:${trimmed}`;
  }

  return trimmed;
}

function parseShellCommand(raw: string): string[] {
  const args: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if ((ch === ' ' || ch === '\t') && !inSingle && !inDouble) {
      if (current) {
        args.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }

  if (current) {
    args.push(current);
  }

  return args;
}
