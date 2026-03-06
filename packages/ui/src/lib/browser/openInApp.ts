import { runtimeSdk } from '@/lib/runtimeSdk';
import { useDirectoryStore } from '@/stores/useDirectoryStore';
import { useUIStore } from '@/stores/useUIStore';

const normalizeUrl = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
};

export const focusInAppBrowser = (directory?: string | null) => {
  const ui = useUIStore.getState();
  const resolvedDirectory = directory ?? useDirectoryStore.getState().currentDirectory ?? null;

  ui.setActiveMainTab('browser');
  ui.setBrowserChatLayoutMode('split', {
    directory: resolvedDirectory,
    makeDefault: !resolvedDirectory,
  });

  if (resolvedDirectory) {
    ui.openContextRuntime(resolvedDirectory, null);
  }
};

export const openUrlInAppBrowser = async (options: {
  url: string;
  sessionID?: string | null;
  directory?: string | null;
}): Promise<boolean> => {
  const normalizedUrl = normalizeUrl(options.url);
  if (!normalizedUrl) {
    return false;
  }

  focusInAppBrowser(options.directory);

  const sessionID = typeof options.sessionID === 'string' && options.sessionID.trim().length > 0
    ? options.sessionID.trim()
    : null;

  if (!sessionID) {
    return false;
  }

  try {
    await runtimeSdk.runBrowserAction(sessionID, 'navigate', { type: 'url', url: normalizedUrl });
    return true;
  } catch {
    return false;
  }
};
