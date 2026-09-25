import { Eyebrow } from '@goodboy/ui';
import { ONBOARDING_STEPS, type OnboardingGroup } from '../onboarding-store';
import type { OnboardingProgress } from '../hooks/useOnboardingProgress';
import { StepRow } from './StepRow';

const GROUP_LABEL: Record<OnboardingGroup, string> = {
  setup: 'Setup',
  build: 'First steps',
};

const GROUP_ORDER: ReadonlyArray<OnboardingGroup> = ['setup', 'build'];

type Props = {
  readonly progress: OnboardingProgress;
};

export const ChecklistBody = ({ progress }: Props) => (
  <div className="flex flex-col gap-2.5">
    {GROUP_ORDER.map((group) => {
      const steps = ONBOARDING_STEPS.filter((step) => step.group === group);
      if (steps.length === 0) {
        return null;
      }
      return (
        <div key={group} className="flex flex-col gap-1">
          <Eyebrow label={GROUP_LABEL[group]} muted className="px-1.5" />
          <ul className="flex flex-col gap-1">
            {steps.map((step) => (
              <StepRow
                key={step.id}
                id={step.id}
                title={step.title}
                why={step.why}
                done={progress.completed.has(step.id)}
              />
            ))}
          </ul>
        </div>
      );
    })}
  </div>
);
