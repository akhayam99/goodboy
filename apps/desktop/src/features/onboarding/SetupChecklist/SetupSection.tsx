import { Button, Eyebrow, Meter } from '@goodboy/ui';
import { PROFILE_SUGGESTION, finish } from '../onboardingSettings';
import type { OnboardingProgress } from '../hooks/useOnboardingProgress';
import { ChecklistBody } from './ChecklistBody';
import { CompletedBody } from './CompletedBody';
import { DoneLine } from './DoneLine';
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
  const doneTitles = setup.rows.filter((row) => row.isDone).map((row) => row.title);
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
          <div className="flex h-6 items-center gap-2 pl-2">
            <Eyebrow label={`Setup · ${setup.count}`} className="shrink-0" />
            <Meter
              label="Setup progress"
              value={setup.done}
              max={setup.total}
              size="xs"
              className="w-16"
            />
            <span className="flex-1" />
            <Button variant="quiet" size="xs" onClick={() => finish()} aria-label="Hide setup">
              Hide
            </Button>
          </div>
          <ChecklistBody progress={progress} isMainWindow={isMainWindow} onLeave={onLeave} />
        </>
      )}
      {progress.suggestsProfile ? (
        <ul className="flex flex-col">
          <StepRow
            title={PROFILE_SUGGESTION.title}
            detail={PROFILE_SUGGESTION.why}
            actionLabel="Open"
            isLead={false}
            onOpen={leaveFor({ action: openProfile })}
          />
        </ul>
      ) : null}
      {!setup.isDone && doneTitles.length > 0 ? (
        <ul className="flex flex-col">
          <DoneLine titles={doneTitles} />
        </ul>
      ) : null}
    </section>
  );
};
