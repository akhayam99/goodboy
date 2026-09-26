import { Check } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import { openWizardStep, type OnboardingStepId } from '../onboarding-store';

type Props = {
  readonly id: OnboardingStepId;
  readonly title: string;
  readonly why: string;
  readonly done: boolean;
};

export const StepRow = ({ id, title, why, done }: Props) => {
  const actionByStep: Partial<Record<OnboardingStepId, () => void>> = {
    provider: () =>
      window.dispatchEvent(
        new CustomEvent('goodboy:open-settings', { detail: { scope: 'providers' } }),
      ),
    project: () => window.dispatchEvent(new CustomEvent('goodboy:add-workspace')),
    codeHost: () => openWizardStep('code-host'),
    taskManager: () => openWizardStep('tasks'),
    firstSession: () => window.dispatchEvent(new CustomEvent('goodboy:new-session')),
    profile: () =>
      window.dispatchEvent(
        new CustomEvent('goodboy:open-settings', {
          detail: { scope: 'workspace', section: 'profile' },
        }),
      ),
  };
  const action = actionByStep[id];
  const activate = () => action?.();

  return (
    <li title={why} className="rounded-md">
      {done || action === undefined ? (
        <span
          className={cn(
            'flex items-center gap-2 px-1.5 py-1 text-secondary',
            done ? 'text-faint-foreground' : 'text-foreground',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border',
              done
                ? cn('border-success', tintClasses('success').bg, 'text-success')
                : 'border-border-soft bg-transparent',
            )}
          >
            {done ? <Check size={9} aria-hidden /> : null}
          </span>
          <span className={cn('truncate', done && 'line-through decoration-1')}>{title}</span>
        </span>
      ) : (
        <button
          type="button"
          onClick={activate}
          title={why}
          aria-label={`Set up ${title}`}
          className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-secondary text-foreground motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span
            aria-hidden
            className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border border-border-soft bg-transparent"
          />
          <span className="truncate">{title}</span>
        </button>
      )}
    </li>
  );
};
