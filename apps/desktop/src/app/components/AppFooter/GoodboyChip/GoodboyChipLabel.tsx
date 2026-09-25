import { StatusDot, cn } from '@goodboy/ui';
import { ONBOARDING_STEPS } from '../../../../features/onboarding/onboarding-store';
import type { OnboardingProgress } from '../../../../features/onboarding/hooks/useOnboardingProgress';
import { DogMascot } from '../../../../shared/components/DogMascot';

export type GoodboyChipState = 'update' | 'setup' | 'rest';

type Props = {
  readonly state: GoodboyChipState;
  readonly progress: OnboardingProgress;
};

const MARK_SIZE = 14;

export const GoodboyChipLabel = ({ state, progress }: Props) => {
  if (state === 'update') {
    return (
      <>
        <StatusDot tone="info" size="sm" />
        <span className="font-semibold text-foreground">Update ready</span>
      </>
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
