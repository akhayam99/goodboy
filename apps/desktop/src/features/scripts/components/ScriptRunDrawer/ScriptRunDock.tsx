import { Check, Copy, Square, X } from 'lucide-react';
import { Button, cn, ICON_SIZE, useCopyLink } from '@goodboy/ui';

import { formatDuration } from '../../../../shared/utils/time/formatDuration';
import { AskOutputButton } from './AskOutputButton';
import { scriptOutcomeLabel } from '../../scriptOutcomeLabel';
import type { ScriptRunStatus } from '../../scripts';

type Props = {
  readonly status: ScriptRunStatus;
  readonly exitCode: number | null;
  readonly elapsedMs: number | null;
  readonly output: string;
  readonly canAsk: boolean;
  readonly askLabel: string;
  readonly onAsk: () => void;
};

export const ScriptRunDock = ({
  status,
  exitCode,
  elapsedMs,
  output,
  canAsk,
  askLabel,
  onAsk,
}: Props) => {
  const { copiedKey, copy } = useCopyLink();

  if (status === 'pending' || status === 'idle') {
    return (
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-meta text-faint-foreground">Following output</span>
        <AskOutputButton
          canAsk={canAsk}
          askLabel={askLabel}
          onAsk={onAsk}
          hasOutput={output !== ''}
        />
      </div>
    );
  }

  const Glyph = status === 'ok' ? Check : status === 'error' ? X : Square;
  const duration = elapsedMs === null ? null : formatDuration({ durationMs: elapsedMs });

  return (
    <div className="flex items-center gap-2">
      <span className="flex min-w-0 flex-1 items-center gap-2 text-meta text-muted-foreground">
        <Glyph
          size={ICON_SIZE.row}
          aria-hidden
          className={cn(
            'shrink-0',
            status === 'ok' && 'text-success',
            status === 'error' && 'text-danger',
          )}
        />
        <span>{scriptOutcomeLabel({ status, exitCode })}</span>
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
      <AskOutputButton
        canAsk={canAsk}
        askLabel={askLabel}
        onAsk={onAsk}
        hasOutput={output !== ''}
      />
    </div>
  );
};
