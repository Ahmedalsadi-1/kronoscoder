import React from "react";
import { RiLoader4Line, RiPlayCircleLine, RiRefreshLine, RiStopCircleLine } from "@remixicon/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getBrowserosBackgroundStatus,
  isDesktopShell,
  startBrowserosBackgroundAgent,
  stopBrowserosBackgroundAgent,
  type BrowserosBackgroundStatus,
} from "@/lib/desktop";
import { cn } from "@/lib/utils";

interface BrowserOSAgentButtonProps {
  className?: string;
}

const formatUpdatedAt = (value: number | null): string => {
  if (!value || !Number.isFinite(value)) {
    return "never";
  }
  try {
    return new Date(value).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "never";
  }
};

const StatusRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className="max-w-[70%] break-all text-right">{value}</span>
  </div>
);

export function BrowserOSAgentButton({ className }: BrowserOSAgentButtonProps) {
  const desktopShell = React.useMemo(() => isDesktopShell(), []);
  const [status, setStatus] = React.useState<BrowserosBackgroundStatus | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [busyAction, setBusyAction] = React.useState<"start" | "stop" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refreshStatus = React.useCallback(async () => {
    if (!desktopShell) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await getBrowserosBackgroundStatus();
      if (!next) {
        setError("Background BrowserOS status is unavailable in this runtime.");
        return;
      }
      setStatus(next);
      if (!next.success && next.error) {
        setError(next.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch BrowserOS background status.");
    } finally {
      setLoading(false);
    }
  }, [desktopShell]);

  React.useEffect(() => {
    if (!desktopShell) {
      return;
    }
    void refreshStatus();
    const interval = window.setInterval(() => {
      void refreshStatus();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [desktopShell, refreshStatus]);

  const handleStart = React.useCallback(async () => {
    if (!desktopShell) {
      return;
    }
    setBusyAction("start");
    setError(null);
    try {
      const next = await startBrowserosBackgroundAgent();
      if (!next) {
        throw new Error("Background BrowserOS start is unavailable in this runtime.");
      }
      setStatus(next);
      if (!next.success) {
        throw new Error(next.error || "Failed to start BrowserOS background agent.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start BrowserOS background agent.");
    } finally {
      setBusyAction(null);
      void refreshStatus();
    }
  }, [desktopShell, refreshStatus]);

  const handleStop = React.useCallback(async () => {
    if (!desktopShell) {
      return;
    }
    setBusyAction("stop");
    setError(null);
    try {
      const next = await stopBrowserosBackgroundAgent();
      if (!next) {
        throw new Error("Background BrowserOS stop is unavailable in this runtime.");
      }
      setStatus(next);
      if (!next.success && next.error) {
        throw new Error(next.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop BrowserOS background agent.");
    } finally {
      setBusyAction(null);
      void refreshStatus();
    }
  }, [desktopShell, refreshStatus]);

  if (!desktopShell) {
    return (
      <div className={cn("rounded-xl border border-border/60 p-4 text-sm text-muted-foreground", className)}>
        BrowserOS background controls are available only in the desktop runtime.
      </div>
    );
  }

  const running = status?.running === true;
  const statusTone = running ? "text-status-success" : "text-muted-foreground";

  return (
    <div className={cn("space-y-3 rounded-xl border border-border/60 p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-medium">Background BrowserOS Agent</h4>
          <p className="text-xs text-muted-foreground">
            CDP-enabled profile for fallback and extension-heavy browser tasks.
          </p>
        </div>
        <Badge variant={running ? "default" : "secondary"} className={cn("text-xs", running && "bg-status-success text-white")}>
          {running ? "running" : "stopped"}
        </Badge>
      </div>

      <div className="space-y-1.5 rounded-md border border-border/60 bg-background/30 px-3 py-2">
        <StatusRow label="Profile" value={<code>{status?.profile || "background"}</code>} />
        <StatusRow label="Server port" value={<code>{status?.port ?? "-"}</code>} />
        <StatusRow label="CDP port" value={<code>{status?.cdpPort ?? (status?.cdpDisabled ? "disabled" : "-")}</code>} />
        <StatusRow
          label="MCP URL"
          value={
            status?.mcpUrl ? (
              <a href={status.mcpUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                {status.mcpUrl}
              </a>
            ) : (
              <code>-</code>
            )
          }
        />
        <StatusRow
          label="CDP URL"
          value={
            status?.cdpDisabled ? (
              <code>disabled</code>
            ) : status?.cdpUrl ? (
              <a href={status.cdpUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                {status.cdpUrl}
              </a>
            ) : (
              <code>-</code>
            )
          }
        />
        <StatusRow
          label="Last update"
          value={<span className={statusTone}>{loading ? "refreshing..." : formatUpdatedAt(status?.updatedAt ?? null)}</span>}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={busyAction !== null || running}
          onClick={() => void handleStart()}
        >
          {busyAction === "start" ? (
            <RiLoader4Line className="h-4 w-4 animate-spin" />
          ) : (
            <RiPlayCircleLine className="h-4 w-4" />
          )}
          Start
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={busyAction !== null || !running}
          onClick={() => void handleStop()}
        >
          {busyAction === "stop" ? (
            <RiLoader4Line className="h-4 w-4 animate-spin" />
          ) : (
            <RiStopCircleLine className="h-4 w-4" />
          )}
          Stop
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          disabled={busyAction !== null || loading}
          onClick={() => void refreshStatus()}
        >
          <RiRefreshLine className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {error ? (
        <p className="text-xs text-status-error">{error}</p>
      ) : null}
    </div>
  );
}

export default BrowserOSAgentButton;
