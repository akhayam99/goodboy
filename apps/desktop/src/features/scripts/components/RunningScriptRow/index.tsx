import { Square } from 'lucide-react';
import { StatusDot, Tooltip, cn, tintClasses } from '@goodboy/ui';
import { formatScriptDuration } from '../../formatScriptDuration';
import type { RunningScript } from '../../hooks/useRunningScripts';

type Props = {
  readonly run: RunningScript;
  readonly now: number;
  readonly onOpen: (run: RunningScript) => void;
  readonly onStop: (run: RunningScript) => void;
};

export const RunningScriptRow = ({ run, now, onOpen, onStop }: Props) => (
  <li className="flex items-center gap-2 px-3 py-2">
    <StatusDot tone="info" size="sm" pulsing />
    <button
      type="button"
      onClick={() => onOpen(run)}
      className="min-w-0 flex-1 text-left"
      aria-label={`Show ${run.scriptName} output from ${run.sessionGoal}`}
    >
      <span className="block truncate text-label font-medium text-foreground">
        {run.scriptName}
      </span>
      <span className="block truncate text-secondary text-muted-foreground">{run.sessionGoal}</span>
    </button>
    <span className="shrink-0 text-secondary tabular-nums text-muted-foreground">
      {formatScriptDuration({ durationMs: now - run.startedAt })}
    </span>
    <Tooltip content={`Stop ${run.scriptName}`}>
      <button
        type="button"
        onClick={() => onStop(run)}
        aria-label={`Stop ${run.scriptName}`}
        className={cn(
          'shrink-0 rounded-sm p-1 text-muted-foreground transition-colors',
          tintClasses('danger').hoverBg,
          'hover:text-danger',
        )}
      >
        <Square size={11} aria-hidden />
      </button>
    </Tooltip>
  </li>
);
