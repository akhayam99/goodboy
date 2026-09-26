import { Check, Copy, Square, X } from 'lucide-react';
import { Button, cn, useCopyLink } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { formatScriptDuration } from '../../formatScriptDuration';
import type { ScriptRunStatus } from '../../scripts';

type Props = {
  readonly status: ScriptRunStatus;
  readonly exitCode: number | null;
  readonly elapsedMs: number | null;
  readonly output: string;
};

type OutcomeParams = {
  readonly status: ScriptRunStatus;
  readonly exitCode: number | null;
};

const outcomeLabel = ({ status, exitCode }: OutcomeParams): string => {
  if (status === 'cancelled') {
    return 'Stopped';
  }
  return exitCode === null ? 'Finished' : `Exit ${exitCode}`;
};

export const ScriptRunDock = ({ status, exitCode, elapsedMs, output }: Props) => {
  const { copiedKey, copy } = useCopyLink();

  if (status === 'pending' || status === 'idle') {
    return (
      <div className="flex items-center gap-2 text-secondary text-faint-foreground">
        Following output
      </div>
    );
  }

  const Glyph = status === 'ok' ? Check : status === 'error' ? X : Square;
  const duration =
    elapsedMs === null ? null : formatScriptDuration({ durationMs: elapsedMs, hasTenths: true });

  return (
    <div className="flex items-center gap-2">
      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-label text-muted-foreground">
        <Glyph
          size={ICON_SIZE.row}
          aria-hidden
          className={cn(
            'shrink-0',
            status === 'ok' && 'text-success',
            status === 'error' && 'text-danger',
          )}
        />
        <span className={cn(status === 'error' && 'text-danger')}>
          {outcomeLabel({ status, exitCode })}
        </span>
        {duration === null ? null : <span>· {duration}</span>}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={output === ''}
        onClick={() => void copy({ text: output, key: 'output' })}
      >
        <Copy size={ICON_SIZE.row} aria-hidden />
        {copiedKey === 'output' ? 'Copied' : 'Copy output'}
      </Button>
    </div>
  );
};
