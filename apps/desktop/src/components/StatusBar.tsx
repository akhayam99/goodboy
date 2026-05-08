import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import { cn } from '@kay-am/ui';
import { openInEditor } from '../editor';
import { DEFAULT_EDITOR_BINARY, SETTING_EDITOR_BINARY } from '../settings';
import { useAppStore, useCurrentSession, useCurrentWorkspace } from '../store';

interface StatusBarProps {
  onEndSession?: () => void;
  onOpenTelemetry?: () => void;
}

function shortenHome(path: string): string {
  const home = '/Users/';
  const idx = path.indexOf(home);
  if (idx !== 0) return path;
  const rest = path.slice(home.length);
  const slash = rest.indexOf('/');
  if (slash === -1) return path;
  return `~${rest.slice(slash)}`;
}

const formatCost = (usd: number): string => `$${usd.toFixed(4)}`;

export function StatusBar({ onEndSession, onOpenTelemetry }: StatusBarProps) {
  const workspace = useCurrentWorkspace();
  const session = useCurrentSession();
  const sessionTelemetry = useAppStore((s) =>
    session ? (s.sessionTelemetry[session.id] ?? null) : null,
  );
  const worktreePath = useAppStore((s) =>
    session ? ((s.sessionWorktrees[session.id] ?? [])[0] ?? null) : null,
  );
  const branch = useAppStore((s) => (session ? (s.sessionBranches[session.id] ?? null) : null));
  const editorBinary = useAppStore(
    (s) => s.settings[SETTING_EDITOR_BINARY] ?? DEFAULT_EDITOR_BINARY,
  );
  const [copied, setCopied] = useState<string | null>(null);
  const lastTurn = sessionTelemetry?.[sessionTelemetry.length - 1] ?? null;
  const sessionStateLabel = session?.state.kind ?? 'idle';

  const onCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      // silent
    }
  };

  const onOpenWorktree = () => {
    if (!worktreePath) return;
    void openInEditor(worktreePath, editorBinary).catch(() => undefined);
  };

  return (
    <div className="flex w-full items-center gap-3">
      <div className="flex flex-1 items-center gap-3 truncate">
        <span aria-hidden>▸</span>
        <span className="text-foreground/80">{workspace?.name ?? 'no workspace'}</span>
        {branch ? (
          <Item
            label={`branch:${branch}`}
            title="copy branch"
            onClick={() => void onCopy(branch, 'branch')}
            highlight={copied === 'branch'}
          />
        ) : null}
        {worktreePath ? (
          <Item
            label={`worktree:${shortenHome(worktreePath)}`}
            title={`open in ${editorBinary}`}
            onClick={onOpenWorktree}
            onAuxClick={() => void onCopy(worktreePath, 'worktree')}
            highlight={copied === 'worktree'}
          />
        ) : null}
        {lastTurn ? (
          <Item
            label={`last:${formatCost(lastTurn.estimatedCostUsd)}`}
            title="open telemetry breakdown"
            onClick={onOpenTelemetry}
          />
        ) : null}
        <span className="text-muted-foreground">{sessionStateLabel}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {session && session.state.kind !== 'ended' && onEndSession ? (
          <button
            type="button"
            onClick={onEndSession}
            className="rounded-sm px-1 hover:bg-muted hover:text-foreground"
            title="end session"
          >
            [end session]
          </button>
        ) : null}
        <span className="inline-flex items-center gap-1" title="press ⌘? for help">
          <CircleHelp size={11} aria-hidden />
          help ⌘?
        </span>
      </div>
    </div>
  );
}

interface ItemProps {
  label: string;
  title?: string;
  onClick?: () => void;
  onAuxClick?: () => void;
  highlight?: boolean;
}

function Item({ label, title, onClick, onAuxClick, highlight }: ItemProps) {
  if (!onClick) {
    return <span className={cn('px-1', highlight && 'text-success')}>{label}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      onAuxClick={onAuxClick}
      title={title}
      className={cn(
        'truncate rounded-sm px-1 hover:bg-muted hover:text-foreground',
        highlight && 'text-success',
      )}
    >
      {label}
    </button>
  );
}
