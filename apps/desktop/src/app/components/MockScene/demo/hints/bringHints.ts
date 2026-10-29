import {
  WIZARD_STEPS,
  type WizardStepId,
} from '../../../../../features/onboarding/OnboardingWizard/wizardSteps';
import type { AppStore } from '../../../../../store/store';
import type { DemoHint, HintCheck } from './demoHintTypes';
import { hasElement } from './hasElement';
import { isOtherControl } from './isOtherControl';

type RootParams = {
  readonly root: Document;
};

const stepIndexOf = ({ root }: RootParams): number => {
  const step = root.querySelector('[aria-label="Goodboy setup"]')?.getAttribute('data-step');
  return WIZARD_STEPS.findIndex((entry) => entry === step);
};

type StepParams = {
  readonly step: WizardStepId;
};

const isOnStep =
  ({ step }: StepParams): HintCheck =>
  ({ root }) =>
    stepIndexOf({ root }) === WIZARD_STEPS.indexOf(step);

const isPastStep =
  ({ step }: StepParams): HintCheck =>
  ({ root }) =>
    stepIndexOf({ root }) > WIZARD_STEPS.indexOf(step);

type StateParams = {
  readonly state: AppStore;
};

const hasLinear = ({ state }: StateParams): boolean =>
  Object.values(state.workspaceIntegrations)
    .flat()
    .some((binding) => binding.provider === 'linear');

const WIZARD_COLUMN = '[data-testid="wizard-column"]';
const WORKSPACE_CREATE = '[data-step="workspace"] [data-demo-anchor="setup-create"]';
const LINEAR_CONNECT = '[data-step="tools"] button[aria-label="Connect Linear"]';

export const BRING_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'setup-create',
    label: 'Create Harborline',
    copy: 'Create your workspace',
    instruction: 'Press **Create** to keep these three repositories together in Harborline.',
    result: 'Harborline now holds payments-api, ledger-core and notify-relay.',
    beat: 0,
    anchor: WORKSPACE_CREATE,
    focus: WIZARD_COLUMN,
    isBlocked: isOtherControl,
    revealWhen: ({ root }) => hasElement({ root, selector: WORKSPACE_CREATE }),
    doneWhen: isPastStep({ step: 'workspace' }),
  },
  {
    id: 'setup-linear',
    label: 'Connect Linear',
    copy: 'Connect Linear',
    instruction: "Press **Connect** on Linear to bring Harborline's issues into Goodboy.",
    result: "Linear is **Connected**, so Harborline's issues can be picked up here.",
    beat: 0,
    anchor: LINEAR_CONNECT,
    focus: WIZARD_COLUMN,
    isBlocked: isOtherControl,
    revealWhen: ({ root }) => hasElement({ root, selector: LINEAR_CONNECT }),
    doneWhen: ({ state, start }) => hasLinear({ state }) && !hasLinear({ state: start }),
  },
  {
    id: 'setup-tools',
    label: 'Keep connected tools',
    copy: 'Continue with these tools',
    instruction: 'Press **Continue** to finish setting up Harborline.',
    result: 'Setup is done, and HBL-412, the duplicate-credit bug, is ready to pick up.',
    beat: 0,
    anchor: '[data-step="tools"] [data-demo-anchor="setup-continue"]',
    focus: WIZARD_COLUMN,
    isBlocked: isOtherControl,
    revealWhen: isOnStep({ step: 'tools' }),
    doneWhen: isPastStep({ step: 'tools' }),
  },
];
