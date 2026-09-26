import { Check, Square, X } from 'lucide-react';
import { StatusDot, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { LastRun } from './describeLastRun';

type Props = {
  readonly lastRun: LastRun | null;
  readonly blockedReason: string | null;
};

export const LastRunCell = ({ lastRun, blockedReason }: Props) => {
  if (lastRun === null) {
    return (
      <span className="w-32 shrink-0 truncate text-secondary text-faint-foreground">
        {blockedReason ?? ''}
      </span>
    );
  }
  const isRunning = lastRun.glyph === 'running';
  return (
    <span
      className={cn(
        'flex w-32 shrink-0 items-center gap-1 truncate text-secondary tabular-nums',
        isRunning ? 'text-info' : 'text-muted-foreground',
      )}
    >
      {isRunning ? <StatusDot tone="info" size="sm" pulsing /> : null}
      {lastRun.glyph === 'passed' ? (
        <Check size={ICON_SIZE.row} aria-hidden className="shrink-0 text-success" />
      ) : null}
      {lastRun.glyph === 'failed' ? (
        <X size={ICON_SIZE.row} aria-hidden className="shrink-0 text-danger" />
      ) : null}
      {lastRun.glyph === 'stopped' ? (
        <Square size={ICON_SIZE.row} aria-hidden className="shrink-0" />
      ) : null}
      <span className={cn('truncate', lastRun.glyph === 'failed' && 'text-danger')}>
        {lastRun.word}
      </span>
      {lastRun.detail === null ? null : (
        <span className="truncate">
          {isRunning ? ' ' : ' · '}
          {lastRun.detail}
        </span>
      )}
    </span>
  );
};
