import {
  WIZARD_STEPS,
  type WizardStepId,
} from '../../../../../features/onboarding/OnboardingWizard/wizardSteps';
import type { AppStore } from '../../../../../store/store';
import type { DemoHint, HintCheck } from './demoHintTypes';

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

const hasSession = ({ state }: StateParams): boolean =>
  state.currentSessionId !== null &&
  state.sessions.some((session) => session.id === state.currentSessionId);

const WIZARD_COLUMN = '[data-testid="wizard-column"]';
const WELCOME = '[data-testid="welcome-cover"]';
const WORKSPACE_CREATE = '[data-step="workspace"] [data-demo-anchor="setup-create"]';

export const ONBOARDING_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'setup-start',
    label: 'Get started',
    copy: 'Begin the setup here',
    instruction: 'Click Get started to see which agents Goodboy found on your Mac.',
    result: 'Goodboy found Claude and Codex on this Mac.',
    beat: 0,
    anchor: '[data-step="welcome"] [data-demo-anchor="setup-start"]',
    focus: WELCOME,
    revealWhen: isOnStep({ step: 'welcome' }),
    doneWhen: isPastStep({ step: 'welcome' }),
  },
  {
    id: 'setup-agents',
    label: 'Keep the agents',
    copy: 'Agents found, ready to use',
    instruction: 'Click Continue to keep these agents and move on to your code.',
    result: 'Claude and Codex are ready to take tasks.',
    beat: 0,
    anchor: '[data-step="agents"] [data-demo-anchor="setup-continue"]',
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'agents' }),
    doneWhen: isPastStep({ step: 'agents' }),
  },
  {
    id: 'setup-workspace',
    label: 'Choose the folder',
    copy: 'Add the sample code',
    instruction: 'Click Choose folder to point Goodboy at the sample Harborline code.',
    result: 'Goodboy found payments-api, ledger-core and notify-relay in that folder.',
    beat: 0,
    anchor: '[data-step="workspace"] [data-demo-anchor="setup-choose-folder"]',
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'workspace' }),
    doneWhen: (probe) =>
      probe.root.querySelector(WORKSPACE_CREATE) !== null ||
      isPastStep({ step: 'workspace' })(probe),
  },
  {
    id: 'setup-create',
    label: 'Create the workspace',
    copy: 'One workspace for these repos',
    instruction: 'Create the workspace so Goodboy can work on the repositories it found.',
    result: 'The Harborline workspace holds the three repositories.',
    beat: 0,
    anchor: WORKSPACE_CREATE,
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'workspace' }),
    doneWhen: isPastStep({ step: 'workspace' }),
  },
  {
    id: 'setup-tools',
    label: 'Keep the tools',
    copy: 'Sample tools connected',
    instruction: 'Click Continue: the sample tools are connected, so agents can use them.',
    result: 'The tools are set for this workspace.',
    beat: 0,
    anchor: '[data-step="tools"] [data-demo-anchor="setup-continue"]',
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'tools' }),
    doneWhen: isPastStep({ step: 'tools' }),
  },
  {
    id: 'setup-first-start',
    label: 'Start a first task',
    copy: 'Hand it to an agent',
    instruction: 'Pick a starter task and press Start: an agent takes it and answers in a session.',
    result: 'A read-only agent is answering in a new session.',
    beat: 0,
    anchor: '[data-step="first-session"] [data-demo-anchor="setup-first-start"]',
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'first-session' }),
    doneWhen: ({ state }) => hasSession({ state }),
  },
];
