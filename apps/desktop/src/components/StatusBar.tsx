import { CircleHelp } from 'lucide-react';
import { useCurrentSession, useCurrentWorkspace } from '../store';
import { TelemetryPill } from './TelemetryPill';

interface StatusBarProps {
  onFocusWorkspaces?: () => void;
}

export function StatusBar({ onFocusWorkspaces }: StatusBarProps) {
  const workspace = useCurrentWorkspace();
  const session = useCurrentSession();
  const sessionStateLabel = session?.state.kind ?? 'idle';

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
        <span className="text-muted-foreground">{sessionStateLabel}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <TelemetryPill />
        <span className="inline-flex items-center gap-1" title="open settings">
          <CircleHelp size={11} aria-hidden />
          <kbd className="font-mono">⌘,</kbd>
        </span>
      </div>
    </div>
  );
}
