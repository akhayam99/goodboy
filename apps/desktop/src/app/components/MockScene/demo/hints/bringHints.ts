import {
  WIZARD_STEPS,
  type WizardStepId,
} from '../../../../../features/onboarding/OnboardingWizard/wizardSteps';
import type { AppStore } from '../../../../../store/store';
import type { DemoHint, HintCheck } from './demoHintTypes';
import { hasElement } from './hasElement';
import { isAnyControl } from './isAnyControl';

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

const hasCodex = ({ state }: StateParams): boolean =>
  state.providers.some(
    (provider) => provider.id === 'codex' && provider.connection === 'connected',
  );

const hasLinear = ({ state }: StateParams): boolean =>
  Object.values(state.workspaceIntegrations)
    .flat()
    .some((binding) => binding.provider === 'linear');

const WIZARD_COLUMN = '[data-testid="wizard-column"]';
const CODEX_SIGN_IN = '[data-step="agents"] [data-demo-anchor="setup-agent-signin"]';
const AGENTS_CONTINUE = '[data-step="agents"] [data-demo-anchor="setup-continue"]';
const WORKSPACE_CREATE = '[data-step="workspace"] [data-demo-anchor="setup-create"]';
const LINEAR_CONNECT = '[data-step="tools"] button[aria-label="Connect Linear"]';
const OPEN_TOOLS = '[data-step="first-session"] [data-demo-anchor="setup-open-tools"]';

export const BRING_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'setup-agent-signin',
    label: 'Sign in Codex',
    copy: 'Add a second agent',
    instruction: 'Press **Sign in** on Codex to add a second agent.',
    result: 'Codex is **Ready** beside Claude.',
    beat: 0,
    anchor: CODEX_SIGN_IN,
    focus: WIZARD_COLUMN,
    isBlocked: isAnyControl,
    revealWhen: ({ root }) => hasElement({ root, selector: CODEX_SIGN_IN }),
    doneWhen: ({ state, start }) => hasCodex({ state }) && !hasCodex({ state: start }),
  },
  {
    id: 'setup-agents',
    label: 'Keep Claude as default',
    copy: 'Continue with Claude',
    instruction: "Press **Continue** to keep Claude as Harborline's default agent.",
    result: "Claude is Harborline's default agent.",
    beat: 0,
    anchor: AGENTS_CONTINUE,
    focus: WIZARD_COLUMN,
    isBlocked: isAnyControl,
    revealWhen: ({ root }) => hasElement({ root, selector: AGENTS_CONTINUE }),
    doneWhen: isPastStep({ step: 'agents' }),
  },
  {
    id: 'setup-create',
    label: 'Create Harborline',
    copy: 'Create your workspace',
    instruction: 'Press **Create** to keep these three repositories together in Harborline.',
    result: 'Harborline now holds payments-api, ledger-core and notify-relay.',
    beat: 0,
    anchor: WORKSPACE_CREATE,
    focus: WIZARD_COLUMN,
    isBlocked: isAnyControl,
    revealWhen: ({ root }) => hasElement({ root, selector: WORKSPACE_CREATE }),
    doneWhen: isPastStep({ step: 'workspace' }),
  },
  {
    id: 'setup-open-tools',
    label: 'Open the issue sources',
    copy: 'Connect an issue source',
    instruction: "Press **Connect Linear or Jira** to bring Harborline's issues into Goodboy.",
    result: 'The tools you can connect are listed here.',
    beat: 0,
    anchor: OPEN_TOOLS,
    focus: WIZARD_COLUMN,
    isBlocked: isAnyControl,
    revealWhen: ({ root }) => hasElement({ root, selector: OPEN_TOOLS }),
    doneWhen: isOnStep({ step: 'tools' }),
  },
  {
    id: 'setup-linear',
    label: 'Connect Linear',
    copy: 'Connect Linear',
    instruction: "Press **Connect** on Linear to bring Harborline's issues into Goodboy.",
    result: "Linear is **Ready**, so Harborline's issues can be picked up here.",
    beat: 0,
    anchor: LINEAR_CONNECT,
    focus: WIZARD_COLUMN,
    isBlocked: isAnyControl,
    revealWhen: ({ root }) => hasElement({ root, selector: LINEAR_CONNECT }),
    doneWhen: ({ state, start }) => hasLinear({ state }) && !hasLinear({ state: start }),
  },
  {
    id: 'setup-tools',
    label: 'Keep connected tools',
    copy: 'Continue with these tools',
    instruction: 'Press **Continue** to finish setting up Harborline.',
    result:
      'Pick up an issue now lists HBL-412, the duplicate-credit bug. Next, set the direction.',
    beat: 0,
    anchor: '[data-step="tools"] [data-demo-anchor="setup-continue"]',
    focus: WIZARD_COLUMN,
    isBlocked: isAnyControl,
    revealWhen: isOnStep({ step: 'tools' }),
    doneWhen: isOnStep({ step: 'first-session' }),
  },
];
