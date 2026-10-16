import { DogMascot, Eyebrow } from '@goodboy/ui';
import type { OnboardingProgress } from '../../../features/onboarding/hooks/useOnboardingProgress';
import { useAppStore } from '../../../store';
import { useRunningAgentCount } from '../../../features/updater/hooks/useRunningAgentCount';
import { UpdatePillVisual } from '../../../features/updater/components/UpdatePill/UpdatePillVisual';

export type GoodboyChipState = 'update' | 'setup' | 'rest';

type Props = {
  readonly state: GoodboyChipState;
  readonly progress: OnboardingProgress;
  readonly installedVersion: string | null;
  readonly isMarkOnly?: boolean;
};

const MARK_SIZE = 14;
const RAIL_MARK_SIZE = 16;

export const GoodboyChipLabel = ({
  state,
  progress,
  installedVersion,
  isMarkOnly = false,
}: Props) => {
  const status = useAppStore((s) => s.updaterStatus);
  const version = useAppStore((s) => s.updateVersion);
  const isQueued = useAppStore((s) => s.updateQueuedUntilIdle);
  const runningCount = useRunningAgentCount();

  if (isMarkOnly) {
    return <DogMascot size={RAIL_MARK_SIZE} className="text-foreground" />;
  }
  if (state === 'update') {
    return (
      <UpdatePillVisual
        isQueued={isQueued}
        isReady={!isQueued && status === 'ready'}
        version={version}
        agentCount={runningCount}
      />
    );
  }
  if (state === 'setup') {
    return (
      <>
        <span className="font-semibold text-foreground">Setup</span>
        <span className="tabular-nums text-faint-foreground">
          {progress.completedCount} of {progress.totalCount}
        </span>
      </>
    );
  }
  return (
    <>
      <DogMascot size={MARK_SIZE} className="text-foreground" />
      <span className="font-semibold text-foreground">Goodboy</span>
      <span aria-hidden className="h-3 w-px bg-border" />
      <Eyebrow label="Beta" muted />
      {installedVersion === null ? null : (
        <span className="tabular-nums text-faint-foreground">v{installedVersion}</span>
      )}
    </>
  );
};
