import { useOnboardingProgress } from '../hooks/useOnboardingProgress';
import { getWizardStep, resumeSetup } from '../onboardingSettings';
import { WIZARD_STEP_LABEL, resumeStep } from '../OnboardingWizard/wizardSteps';

type Params = {
  readonly isMainWindow: boolean;
};

export type SetupResume = {
  readonly label: string;
  readonly resume: () => void;
};

export const useSetupResume = ({ isMainWindow }: Params): SetupResume | null => {
  const progress = useOnboardingProgress();
  if (!isMainWindow || progress.isWizardDone || progress.setup.isDone) {
    return null;
  }
  const step = resumeStep({ saved: getWizardStep(), hasWorkspace: progress.hasWorkspace });
  return {
    label: `Setup paused at ${WIZARD_STEP_LABEL[step]} · ${progress.setup.count} done`,
    resume: () => resumeSetup({ hasWorkspace: progress.hasWorkspace }),
  };
};
