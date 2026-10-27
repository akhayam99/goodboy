import { Button, Eyebrow } from '@goodboy/ui';
import { PROFILE_SUGGESTION, finish, resumeSetup } from '../onboardingSettings';
import type { OnboardingProgress } from '../hooks/useOnboardingProgress';
import { ChecklistBody } from './ChecklistBody';
import { CompletedBody } from './CompletedBody';
import { StepRow } from './StepRow';
import { openSettings } from '../../settings/openSettings';

type Props = {
  readonly progress: OnboardingProgress;
  readonly isMainWindow: boolean;
  readonly onLeave: () => void;
};

type LeaveParams = {
  readonly action: () => void;
};

const openProfile = () => openSettings({ scope: 'workspace', section: 'profile' });

export const SetupSection = ({ progress, isMainWindow, onLeave }: Props) => {
  const { setup } = progress;
  const canResume = isMainWindow && !progress.isWizardDone;
  const leaveFor =
    ({ action }: LeaveParams) =>
    () => {
      onLeave();
      action();
    };

  return (
    <section aria-label="Setup" className="flex flex-col gap-1 px-2">
      {setup.isDone ? (
        <div className="flex flex-col gap-2 px-1">
          <CompletedBody />
        </div>
      ) : (
        <>
          <div className="flex h-6 items-center gap-1 pl-2">
            <Eyebrow label={`Setup · ${setup.count}`} className="min-w-0 flex-1" />
            {canResume ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={leaveFor({
                  action: () => resumeSetup({ hasWorkspace: progress.hasWorkspace }),
                })}
              >
                Resume setup
              </Button>
            ) : null}
            <Button variant="quiet" size="xs" onClick={() => finish()} aria-label="Hide setup">
              Hide
            </Button>
          </div>
          <div className="px-2">
            <div
              role="progressbar"
              aria-label="Setup progress"
              aria-valuemin={0}
              aria-valuemax={setup.total}
              aria-valuenow={setup.done}
              className="h-0.75 overflow-hidden rounded-full bg-fill"
            >
              <div
                className="h-full rounded-full bg-primary motion-safe:transition-[width]"
                style={{ width: `${setup.fraction * 100}%` }}
              />
            </div>
          </div>
          <ChecklistBody progress={progress} isMainWindow={isMainWindow} onLeave={onLeave} />
        </>
      )}
      {progress.suggestsProfile ? (
        <div className="flex flex-col gap-1">
          <Eyebrow label="Next" muted className="px-2" />
          <ul className="flex flex-col">
            <StepRow
              title={PROFILE_SUGGESTION.title}
              detail={PROFILE_SUGGESTION.why}
              isDone={false}
              actionLabel="Open"
              onOpen={leaveFor({ action: openProfile })}
            />
          </ul>
        </div>
      ) : null}
    </section>
  );
};
