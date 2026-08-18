import { X } from 'lucide-react';
import { collapse, visibleOnboardingSteps, type OnboardingGroup } from '../onboarding-store';
import type { OnboardingProgress } from '../hooks/useOnboardingProgress';
import { StepRow } from './StepRow';
import { Tooltip } from '@goodboy/ui';

const GROUP_LABEL: Record<OnboardingGroup, string> = {
  setup: 'Setup',
  build: 'First steps',
};

const GROUP_ORDER: ReadonlyArray<OnboardingGroup> = ['setup', 'build'];

type Props = {
  readonly progress: OnboardingProgress;
};

export const ChecklistBody = ({ progress }: Props) => {
  const visibleSteps = visibleOnboardingSteps({ isSimple: progress.isSimple });
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-tight text-foreground">Goodboy setup</span>
        <Tooltip content="Hide onboarding checklist (reopen it from the top bar)">
          <button
            type="button"
            onClick={() => collapse()}
            aria-label="Hide onboarding checklist"
            className="rounded-md p-0.5 text-muted-foreground/70 motion-safe:transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <X size={11} aria-hidden />
          </button>
        </Tooltip>
      </div>
      <div className="flex flex-col gap-2.5">
        {GROUP_ORDER.map((group) => {
          const steps = visibleSteps.filter((step) => step.group === group);
          if (steps.length === 0) {
            return null;
          }
          return (
            <div key={group} className="flex flex-col gap-1">
              <span className="px-1.5 text-3xs font-medium uppercase tracking-[0.08em] text-muted-foreground/50">
                {GROUP_LABEL[group]}
              </span>
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
      <p className="text-3xs leading-snug text-muted-foreground/60">
        {progress.completedCount} of {progress.totalCount} steps done
      </p>
    </>
  );
};
