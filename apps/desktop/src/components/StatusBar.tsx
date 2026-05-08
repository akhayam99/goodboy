import { CircleHelp } from 'lucide-react';
import { useAppStore, useCurrentSession, useCurrentWorkspace } from '../store';
import { useToast } from './Toast';
import { TelemetryPill } from './TelemetryPill';

interface StatusBarProps {
  onFocusWorkspaces?: () => void;
}

function inferBranch(worktreePath: string | null, sessionId: string | null): string | null {
  if (!worktreePath) return sessionId ? sessionId.slice(0, 8) : null;
  const tail = worktreePath.split('/').filter(Boolean).at(-1);
  return tail ?? null;
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

export function StatusBar({ onFocusWorkspaces }: StatusBarProps) {
  const workspace = useCurrentWorkspace();
  const session = useCurrentSession();
  const worktreePath = useAppStore((s) =>
    session ? ((s.sessionWorktrees[session.id] ?? [])[0] ?? null) : null,
  );
  const { showToast } = useToast();

  const branch = session ? inferBranch(worktreePath, session.id) : null;
  const sessionStateLabel = session?.state.kind ?? 'idle';

  const onCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('success', `copied ${label}`);
    } catch {
      // clipboard denied — silent
    }
  };

  return (
    <div className="flex w-full items-center gap-3">
      <div className="flex flex-1 items-center gap-3 truncate">
        <span aria-hidden>▸</span>
        <button
          type="button"
          onClick={onFocusWorkspaces}
          title="focus workspaces  ⌘1"
          className="text-foreground/80 hover:text-foreground hover:underline disabled:cursor-default disabled:no-underline"
          disabled={!onFocusWorkspaces}
        >
          {workspace?.name ?? 'no workspace'}
        </button>
        {branch ? (
          <CopyItem
            label={`branch:${branch}`}
            copyValue={branch}
            copyLabel="branch"
            onCopy={onCopy}
          />
        ) : null}
        {worktreePath ? (
          <CopyItem
            label={`worktree:${shortenHome(worktreePath)}`}
            copyValue={worktreePath}
            copyLabel="worktree path"
            onCopy={onCopy}
          />
        ) : null}
        <span className="text-muted-foreground">{sessionStateLabel}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <TelemetryPill />
        <span className="inline-flex items-center gap-1" title="open settings">
          <CircleHelp size={11} aria-hidden />
          <kbd className="font-mono">⌘,</kbd>
          {/* TODO (@ak): cmd+K palette not shipped yet */}
        </span>
      </div>
    </div>
  );
}

function CopyItem({
  label,
  copyValue,
  copyLabel,
  onCopy,
}: {
  label: string;
  copyValue: string;
  copyLabel: string;
  onCopy: (text: string, label: string) => Promise<void>;
}) {
  return (
    <button
      type="button"
      onClick={() => void onCopy(copyValue, copyLabel)}
      title={`copy ${copyLabel}`}
      className="truncate rounded-sm px-1 hover:bg-muted hover:text-foreground"
    >
      {label}
    </button>
  );
}
