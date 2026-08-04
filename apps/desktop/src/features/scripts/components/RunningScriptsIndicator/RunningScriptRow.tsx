import { Square } from 'lucide-react';
import { StatusDot } from '@goodboy/ui';
import type { RunningScript } from './useRunningScripts';

type Props = {
  readonly run: RunningScript;
  readonly now: number;
  readonly onOpen: (run: RunningScript) => void;
  readonly onStop: (run: RunningScript) => void;
};

const elapsed = (ms: number): string => {
  const seconds = Math.max(0, Math.floor(ms / 1_000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};

export const RunningScriptRow = ({ run, now, onOpen, onStop }: Props) => (
  <li className="flex items-center gap-2 px-3 py-2">
    <StatusDot tone="info" size="sm" pulsing />
    <button
      type="button"
      onClick={() => onOpen(run)}
      className="min-w-0 flex-1 text-left"
      aria-label={`Go to ${run.scriptName} in ${run.sessionGoal}`}
    >
      <span className="block truncate text-xs font-medium text-foreground">{run.scriptName}</span>
      <span className="block truncate text-2xs text-muted-foreground">{run.sessionGoal}</span>
    </button>
    <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
      {elapsed(now - run.startedAt)}
    </span>
    <button
      type="button"
      onClick={() => onStop(run)}
      aria-label={`Stop ${run.scriptName}`}
      className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
    >
      <Square size={11} aria-hidden />
    </button>
  </li>
);
