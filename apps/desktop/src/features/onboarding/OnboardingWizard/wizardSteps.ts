import type { WizardMode } from '../onboarding-store';
import type { WorkspaceShape } from './steps/ShapeStep';

export type WizardStepId = 'welcome' | 'providers' | 'shape' | 'projects' | 'profile' | 'ready';

export const WIZARD_STEPS = [
  'welcome',
  'providers',
  'shape',
  'projects',
  'profile',
  'ready',
] as const satisfies ReadonlyArray<WizardStepId>;

const SETUP_START: WizardStepId = 'profile';

export const visibleWizardSteps = ({
  mode,
  shape,
}: {
  readonly mode: WizardMode;
  readonly shape: WorkspaceShape | null;
}): ReadonlyArray<WizardStepId> => {
  const start = mode === 'setup' ? WIZARD_STEPS.indexOf(SETUP_START) : 0;
  return WIZARD_STEPS.slice(start).filter(
    (candidate) => candidate !== 'projects' || shape !== 'single',
  );
};
