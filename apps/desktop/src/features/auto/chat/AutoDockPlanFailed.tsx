import type { ReactNode } from 'react';
import { Button, Tooltip, tintClasses } from '@goodboy/ui';
import { AUTO_STATE_TONE } from './autoStateTone';

type Props = {
  readonly version: number;
  readonly reason: string | null;
  readonly openPlan: ReactNode;
  readonly isBusy: boolean;
  readonly onKeep: () => void;
  readonly onRetry: () => void;
};

export const AutoDockPlanFailed = ({
  version,
  reason,
  openPlan,
  isBusy,
  onKeep,
  onRetry,
}: Props) => (
  <div
    data-dock-plan="failed"
    className="flex min-h-7 min-w-0 flex-wrap items-center gap-2 text-meta"
  >
    <span role="status" aria-live="polite" className={tintClasses(AUTO_STATE_TONE.failed).text}>
      {`Plan v${version + 1} failed`}
    </span>
    {reason === null ? null : (
      <Tooltip content={reason}>
        <span className="min-w-0 truncate text-muted-foreground">{reason}</span>
      </Tooltip>
    )}
    <span className="flex-1" />
    {openPlan}
    <Button variant="quiet" size="xs" disabled={isBusy} onClick={onKeep}>
      {`Keep plan v${version}`}
    </Button>
    <Button variant="primary" size="sm" disabled={isBusy} onClick={onRetry}>
      {`Retry plan v${version + 1}`}
    </Button>
  </div>
);
