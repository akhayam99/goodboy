import type { WizardMode } from '../onboarding-store';

export type WizardStepId =
  'welcome' | 'providers' | 'project' | 'code-host' | 'tasks' | 'first-session';

export type NumberedWizardStepId = Exclude<WizardStepId, 'welcome'>;

export const WIZARD_STEPS = [
  'welcome',
  'providers',
  'project',
  'code-host',
  'tasks',
  'first-session',
] as const satisfies ReadonlyArray<WizardStepId>;

export const WIZARD_STEP_LABEL: Readonly<Record<NumberedWizardStepId, string>> = {
  providers: 'Provider',
  project: 'Project',
  'code-host': 'Code host',
  tasks: 'Tasks',
  'first-session': 'First session',
};

const SETUP_START: WizardStepId = 'code-host';

export const isNumberedStep = (step: WizardStepId): step is NumberedWizardStepId =>
  step !== 'welcome';

export const visibleWizardSteps = ({
  mode,
  start,
  skipsCodeHost,
}: {
  readonly mode: WizardMode;
  readonly start: WizardStepId | null;
  readonly skipsCodeHost: boolean;
}): ReadonlyArray<WizardStepId> => {
  if (mode === 'single') {
    return [start ?? SETUP_START];
  }
  const first = mode === 'setup' ? WIZARD_STEPS.indexOf(start ?? SETUP_START) : 0;
  return WIZARD_STEPS.slice(first).filter(
    (candidate) => candidate !== 'code-host' || !skipsCodeHost,
  );
};
