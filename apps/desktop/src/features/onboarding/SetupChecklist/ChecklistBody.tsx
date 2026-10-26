import { dispatchWindowEvent } from '../../../shared/lib/dispatchWindowEvent';
import { openSettings } from '../../settings/openSettings';
import { openWizardStep, resumeSetup } from '../onboardingSettings';
import type { OnboardingProgress } from '../hooks/useOnboardingProgress';
import type { SetupItemId } from '../setupProgress';
import { StepRow } from './StepRow';

type Props = {
  readonly progress: OnboardingProgress;
  readonly isMainWindow: boolean;
  readonly onLeave: () => void;
};

type ActionParams = {
  readonly id: SetupItemId;
  readonly progress: OnboardingProgress;
  readonly isMainWindow: boolean;
};

const AFTER_SETUP: Readonly<Record<SetupItemId, (() => void) | null>> = {
  agents: () => openSettings({ scope: 'providers' }),
  workspace: () => dispatchWindowEvent({ name: 'goodboy:add-workspace' }),
  tools: () => openWizardStep('tools'),
  'first-session': () => dispatchWindowEvent({ name: 'goodboy:new-session' }),
};

const MAIN_WINDOW_ONLY: ReadonlySet<SetupItemId> = new Set(['tools']);

const actionFor = ({ id, progress, isMainWindow }: ActionParams): (() => void) | null => {
  if (!progress.isWizardDone) {
    return isMainWindow
      ? () => resumeSetup({ step: id, hasWorkspace: progress.hasWorkspace })
      : null;
  }
  if (!isMainWindow && MAIN_WINDOW_ONLY.has(id)) {
    return null;
  }
  return AFTER_SETUP[id];
};

export const ChecklistBody = ({ progress, isMainWindow, onLeave }: Props) => (
  <ul className="flex flex-col gap-1">
    {progress.setup.rows.map((row) => {
      const action = actionFor({ id: row.id, progress, isMainWindow });
      return (
        <StepRow
          key={row.id}
          title={row.title}
          detail={progress.details[row.id]}
          isDone={row.isDone}
          actionLabel={row.id === 'first-session' ? 'Start' : 'Open'}
          onOpen={
            action === null
              ? null
              : () => {
                  onLeave();
                  action();
                }
          }
        />
      );
    })}
  </ul>
);
