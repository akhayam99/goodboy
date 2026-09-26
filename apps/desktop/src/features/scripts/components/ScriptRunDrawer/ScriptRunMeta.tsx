import { StatusDot, cn } from '@goodboy/ui';
import { formatScriptDuration } from '../../formatScriptDuration';
import type { ScriptRunStatus } from '../../scripts';
import { SCRIPT_RUN_PRESENTATION } from '../../scriptRunPresentation';

type Props = {
  readonly status: ScriptRunStatus;
  readonly elapsedMs: number | null;
  readonly projectName: string | null;
  readonly branch: string | null;
};

export const ScriptRunMeta = ({ status, elapsedMs, projectName, branch }: Props) => {
  const presentation = SCRIPT_RUN_PRESENTATION[status];
  const isRunning = status === 'pending';
  const parts = [
    elapsedMs === null
      ? null
      : formatScriptDuration({ durationMs: elapsedMs, hasTenths: !isRunning }),
    projectName,
    branch === '' ? null : branch,
  ].filter((part): part is string => part !== null);

  return (
    <p className="flex shrink-0 items-center gap-1.5 text-secondary text-muted-foreground">
      {isRunning ? <StatusDot tone="info" size="sm" pulsing /> : null}
      <span className={cn(isRunning && presentation.textClass)}>{presentation.statusLabel}</span>
      {parts.map((part) => (
        <span key={part} className="truncate">
          · {part}
        </span>
      ))}
    </p>
  );
};
