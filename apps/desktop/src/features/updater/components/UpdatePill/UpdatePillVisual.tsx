import { ArrowUpCircle, Clock } from 'lucide-react';
import { Chip } from '@goodboy/ui';

type Props = {
  readonly isQueued: boolean;
  readonly isReady: boolean;
  readonly version: string | null;
  readonly agentCount: number;
};

export const UpdatePillVisual = ({ isQueued, isReady, version, agentCount }: Props) => {
  const label = isQueued
    ? `Restarts after ${agentCount} agent${agentCount === 1 ? '' : 's'}`
    : `${version ?? 'update'} ${isReady ? 'ready' : 'available'}`;
  const tooltip = isReady
    ? `Goodboy ${version ?? ''} is downloaded. Restart to use it.`
    : undefined;

  return (
    <span className="inline-flex rounded-full motion-safe:animate-studio-body-in">
      <Chip
        tone={isQueued ? 'info' : 'primary'}
        emphasis="soft"
        shape="pill"
        icon={isQueued ? <Clock size={11} aria-hidden /> : <ArrowUpCircle size={11} aria-hidden />}
        label={label}
        title={tooltip}
        testId="update-pill"
      />
    </span>
  );
};
