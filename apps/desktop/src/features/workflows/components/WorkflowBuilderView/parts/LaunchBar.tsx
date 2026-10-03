import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button, FormActions, cn } from '@goodboy/ui';
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
  <FormActions leading={controls} reason={reason} reasonId={START_REASON_ID}>
    {canDiscard ? (
      <Button
        variant="ghost"
        size="sm"
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
      className="shrink-0"
    >
      <span className={cn(isStarting && 'text-shimmer')}>
        {isStarting ? 'Starting…' : 'Start workflow'}
      </span>
    </Button>
  </FormActions>
);
