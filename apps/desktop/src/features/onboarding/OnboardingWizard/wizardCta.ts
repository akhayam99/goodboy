import type { WizardStepId } from './wizardSteps';

export type WizardCtaAction = 'next' | 'commit-project' | 'finish';

export type WizardCta = {
  readonly label: string;
  readonly action: WizardCtaAction;
  readonly disabled: boolean;
};

export type WizardActions = {
  readonly primary: WizardCta | null;
  readonly skip: WizardCta | null;
  readonly hint: string | null;
};

export const PROVIDER_GATE_HINT =
  'Connect one provider to continue. Install sets up a missing CLI, then signs you in.';

type Params = {
  readonly step: WizardStepId;
  readonly providersConnected: number;
  readonly hasWorkspace: boolean;
  readonly workspaceName: string;
  readonly projectCount: number;
  readonly codeHostConnected: boolean;
  readonly taskSourceConnected: boolean;
  readonly isLastStep: boolean;
  readonly busy: boolean;
};

const cta = ({
  label,
  action,
  disabled = false,
}: {
  readonly label: string;
  readonly action: WizardCtaAction;
  readonly disabled?: boolean;
}): WizardCta => ({ label, action, disabled });

const actions = ({
  primary,
  skip = null,
  hint = null,
}: {
  readonly primary: WizardCta | null;
  readonly skip?: WizardCta | null;
  readonly hint?: string | null;
}): WizardActions => ({ primary, skip, hint });

const optionalStep = ({
  isConnected,
  isLastStep,
  busy,
}: {
  readonly isConnected: boolean;
  readonly isLastStep: boolean;
  readonly busy: boolean;
}): WizardActions => {
  const action: WizardCtaAction = isLastStep ? 'finish' : 'next';
  return actions({
    primary: cta({
      label: isLastStep ? 'Done' : 'Continue',
      action,
      disabled: busy || !isConnected,
    }),
    skip: isConnected ? null : cta({ label: 'Skip for now', action, disabled: busy }),
  });
};

export const wizardActions = ({
  step,
  providersConnected,
  hasWorkspace,
  workspaceName,
  projectCount,
  codeHostConnected,
  taskSourceConnected,
  isLastStep,
  busy,
}: Params): WizardActions => {
  switch (step) {
    case 'welcome':
      return actions({ primary: cta({ label: 'Get started', action: 'next' }) });
    case 'providers':
      return actions({
        primary: cta({ label: 'Continue', action: 'next', disabled: providersConnected === 0 }),
        hint: providersConnected === 0 ? PROVIDER_GATE_HINT : null,
      });
    case 'project':
      return actions({
        primary: cta({
          label: 'Continue',
          action: 'commit-project',
          disabled:
            busy || !hasWorkspace || projectCount === 0 || workspaceName.trim().length === 0,
        }),
      });
    case 'code-host':
      return optionalStep({ isConnected: codeHostConnected, isLastStep, busy });
    case 'tasks':
      return optionalStep({ isConnected: taskSourceConnected, isLastStep, busy });
    case 'first-session':
      return actions({
        primary: null,
        skip: cta({ label: 'Skip, open the board', action: 'finish', disabled: busy }),
      });
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
};
