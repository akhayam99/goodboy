import { cn } from '@goodboy/ui';
import { ONBOARDING_STEPS } from '../../../../features/onboarding/onboarding-store';
import type { OnboardingProgress } from '../../../../features/onboarding/hooks/useOnboardingProgress';
import { DogMascot } from '../../../../shared/components/DogMascot';
import { useAppStore } from '../../../../store';
import { useRunningAgentCount } from '../../../../features/updater/hooks/useRunningAgentCount';
import { useUpdateSweep } from '../../../../features/updater/hooks/useUpdateSweep';
import { UpdatePillVisual } from '../../../../features/updater/components/UpdatePill/UpdatePillVisual';

export type GoodboyChipState = 'update' | 'setup' | 'rest';

type Props = {
  readonly state: GoodboyChipState;
  readonly progress: OnboardingProgress;
};

const MARK_SIZE = 14;

export const GoodboyChipLabel = ({ state, progress }: Props) => {
  const status = useAppStore((s) => s.updaterStatus);
  const version = useAppStore((s) => s.updateVersion);
  const isQueued = useAppStore((s) => s.updateQueuedUntilIdle);
  const runningCount = useRunningAgentCount();
  const isReady = status === 'ready';
  const isAvailable = status === 'available';
  const sweepKey = useUpdateSweep({ active: (isReady || isAvailable) && !isQueued });

  if (state === 'update') {
    if (isQueued) {
      return (
        <UpdatePillVisual
          isQueued
          isReady={false}
          version={version}
          agentCount={runningCount}
          sweepKey={null}
        />
      );
    }
    return (
      <UpdatePillVisual
        isQueued={false}
        isReady={isReady}
        version={version}
        agentCount={runningCount}
        sweepKey={sweepKey}
      />
    );
  }
  if (state === 'setup') {
    return (
      <>
        <span aria-hidden className="flex items-center gap-0.5">
          {ONBOARDING_STEPS.map((step) => (
            <span
              key={step.id}
              className={cn(
                'size-1.5 rounded-full',
                progress.completed.has(step.id) ? 'bg-primary' : 'bg-idle',
              )}
            />
          ))}
        </span>
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
      <span className="text-faint-foreground">beta</span>
    </>
  );
};
