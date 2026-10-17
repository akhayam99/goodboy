import type { ReactNode } from 'react';
import { Button, FormActions, cn } from '@goodboy/ui';
import { NAMES } from '../../../../../shared/names';

type Props = {
  readonly controls: ReactNode;
  readonly estimate?: ReactNode;
  readonly reason: string | null;
  readonly error?: string | null;
  readonly isStartDisabled: boolean;
  readonly isStarting: boolean;
  readonly size?: 'sm' | 'md';
  readonly label: string | null;
  readonly canDiscard?: boolean;
  readonly onDiscard?: () => void;
  readonly onStart: () => void;
};

const START_REASON_ID = 'workflow-start-reason';

export const LaunchBar = ({
  controls,
  estimate = null,
  reason,
  error = null,
  isStartDisabled,
  isStarting,
  size = 'md',
  label,
  canDiscard = false,
  onDiscard,
  onStart,
}: Props) => (
  <FormActions leading={controls} reason={reason} reasonId={START_REASON_ID} error={error}>
    {canDiscard && onDiscard !== undefined ? (
      <Button variant="ghost" size="sm" onClick={onDiscard} disabled={isStarting}>
        Discard
      </Button>
    ) : null}
    {estimate === null ? null : (
      <span data-testid="launch-estimate-slot" className="flex min-h-6 items-center">
        {estimate}
      </span>
    )}
    <Button
      size={size}
      onClick={onStart}
      disabled={isStartDisabled}
      {...(reason === null ? {} : { 'aria-describedby': START_REASON_ID })}
      className="shrink-0"
    >
      <span className={cn(isStarting && 'text-shimmer')}>
        {isStarting ? NAMES.starting : error !== null ? NAMES.retry : (label ?? NAMES.startRun)}
      </span>
    </Button>
  </FormActions>
);
