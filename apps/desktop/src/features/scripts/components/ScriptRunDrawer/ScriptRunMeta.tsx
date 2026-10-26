import { StatusDot } from '@goodboy/ui';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { formatDuration } from '../../../../shared/utils/time/formatDuration';
import type { ScriptRunStatus } from '../../scripts';

type Props = {
  readonly status: ScriptRunStatus;
  readonly elapsedMs: number | null;
  readonly branch: string | null;
};

export const ScriptRunMeta = ({ status, elapsedMs, branch }: Props) => {
  const isRunning = status === 'pending';
  const facts = joinFacts({
    facts: [
      isRunning && elapsedMs !== null ? formatDuration({ durationMs: elapsedMs }) : null,
      branch,
    ],
  });
  if (facts === '' && !isRunning) {
    return null;
  }
  return (
    <p className="flex shrink-0 items-center gap-2 text-meta tabular-nums text-muted-foreground">
      {isRunning ? <StatusDot tone="info" size="sm" pulsing ariaLabel="Running" /> : null}
      <span className="truncate">{facts}</span>
      {isRunning ? (
        <span className="min-w-0 flex-1 truncate text-right text-faint-foreground">
          Output only. Stop ends it.
        </span>
      ) : null}
    </p>
  );
};
