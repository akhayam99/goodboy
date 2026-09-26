import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';

type Props = {
  readonly controls: ReactNode;
  readonly reason: string | null;
  readonly isStartDisabled: boolean;
  readonly isStarting: boolean;
  readonly canDiscard: boolean;
  readonly onDiscard: () => void;
  readonly onStart: () => void;
};

const START_REASON_ID = 'workflow-start-reason';

export const LaunchBar = ({
  controls,
  reason,
  isStartDisabled,
  isStarting,
  canDiscard,
  onDiscard,
  onStart,
}: Props) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">{controls}</div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {canDiscard ? (
          <Button
            variant="ghost"
            size="md"
            onClick={onDiscard}
            disabled={isStarting}
            aria-label="Discard workflow draft"
            className="gap-1.5 text-muted-foreground"
          >
            <RotateCcw size={ICON_SIZE.control} aria-hidden />
            Discard
          </Button>
        ) : null}
        <Button
          size="md"
          onClick={onStart}
          disabled={isStartDisabled}
          {...(reason === null ? {} : { 'aria-describedby': START_REASON_ID })}
          className={cn('shrink-0', isStarting && 'animate-border-pulse')}
        >
          {isStarting ? 'Starting…' : 'Start workflow'}
        </Button>
      </div>
    </div>
    {reason === null ? null : (
      <p id={START_REASON_ID} className="self-end text-secondary text-faint-foreground">
        {reason}
      </p>
    )}
  </div>
);
