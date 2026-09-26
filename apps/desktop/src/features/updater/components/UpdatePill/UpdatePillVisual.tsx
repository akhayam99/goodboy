import { ArrowUpCircle, Clock } from 'lucide-react';
import { Chip } from '@goodboy/ui';

type Props = {
  readonly isQueued: boolean;
  readonly isReady: boolean;
  readonly version: string | null;
  readonly agentCount: number;
  readonly sweepKey: number | null;
};

export const UpdatePillVisual = ({ isQueued, isReady, version, agentCount, sweepKey }: Props) => {
  const label = isQueued
    ? `Restarts after ${agentCount} agent${agentCount === 1 ? '' : 's'}`
    : `${version ?? 'update'} ${isReady ? 'ready' : 'available'}`;
  const tooltip = isReady
    ? `Goodboy ${version ?? ''} is downloaded. Restart to use it.`
    : undefined;

  return (
    <span className="relative inline-flex overflow-hidden rounded-full">
      <Chip
        tone={isQueued ? 'info' : 'primary'}
        emphasis="strong"
        shape="pill"
        icon={isQueued ? <Clock size={11} aria-hidden /> : <ArrowUpCircle size={11} aria-hidden />}
        label={label}
        title={tooltip}
        testId="update-pill"
      />
      {sweepKey !== null ? (
        <span
          key={sweepKey}
          aria-hidden
          className="update-sweep pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-primary/35 to-transparent"
        />
      ) : null}
    </span>
  );
};
