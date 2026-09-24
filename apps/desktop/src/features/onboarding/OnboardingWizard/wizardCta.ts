import type { WorkspaceShape } from './steps/ShapeStep';
import type { WizardStepId } from './wizardSteps';

export type WizardCtaAction = 'next' | 'commit-name' | 'commit-profile' | 'finish';

export type WizardCta = {
  readonly label: string;
  readonly action: WizardCtaAction;
  readonly disabled: boolean;
  readonly hint: string | null;
};

export const PROVIDER_GATE_HINT =
  'Connect one provider to continue. Install sets up a missing CLI, then signs you in.';

type Params = {
  readonly step: WizardStepId;
  readonly providersConnected: number;
  readonly shape: WorkspaceShape | null;
  readonly hasWorkspace: boolean;
  readonly workspaceName: string;
  readonly projectCount: number;
  readonly busy: boolean;
};

const cta = ({
  label,
  action,
  disabled = false,
  hint = null,
}: {
  readonly label: string;
  readonly action: WizardCtaAction;
  readonly disabled?: boolean;
  readonly hint?: string | null;
}): WizardCta => ({ label, action, disabled, hint });

export const wizardCta = ({
  step,
  providersConnected,
  shape,
  hasWorkspace,
  workspaceName,
  projectCount,
  busy,
}: Params): WizardCta | null => {
  switch (step) {
    case 'welcome':
      return cta({ label: 'Get started', action: 'next' });
    case 'providers':
      return cta({
        label: 'Continue',
        action: 'next',
        disabled: providersConnected === 0,
        hint: providersConnected === 0 ? PROVIDER_GATE_HINT : null,
      });
    case 'shape':
      if (shape === 'single' && !hasWorkspace) {
        return null;
      }
      return cta({
        label: hasWorkspace ? 'Continue' : 'Create workspace',
        action: 'commit-name',
        disabled: busy || shape === null || workspaceName.trim().length === 0,
      });
    case 'projects':
      return cta({ label: 'Continue', action: 'next', disabled: projectCount === 0 });
    case 'profile':
      return cta({ label: 'Continue', action: 'commit-profile', disabled: busy });
    case 'ready':
      return cta({ label: 'Start building', action: 'finish' });
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
};
