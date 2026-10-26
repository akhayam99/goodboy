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
    copy: 'Begin the setup here',
    instruction: 'Click Get started to see which agents Goodboy found on your Mac.',
    outcome: 'setup-opened',
    anchor: '[data-step="welcome"] [data-demo-anchor="setup-start"]',
    focus: WELCOME,
    revealWhen: isOnStep({ step: 'welcome' }),
    doneWhen: isPastStep({ step: 'welcome' }),
  },
  {
    id: 'setup-agents',
    copy: 'Agents found, ready to use',
    instruction: 'Click Continue to keep these agents and move on to your code.',
    outcome: 'agents-ready',
    anchor: '[data-step="agents"] [data-demo-anchor="setup-continue"]',
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'agents' }),
    doneWhen: isPastStep({ step: 'agents' }),
  },
  {
    id: 'setup-workspace',
    copy: 'Add the sample code',
    instruction: 'Click Choose folder to point Goodboy at the sample Harborline code.',
    outcome: null,
    anchor: '[data-step="workspace"] [data-demo-anchor="setup-choose-folder"]',
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'workspace' }),
    doneWhen: ({ root }) =>
      root.querySelector(WORKSPACE_CREATE) !== null ||
      stepIndexOf({ root }) > WIZARD_STEPS.indexOf('workspace'),
  },
  {
    id: 'setup-create',
    copy: 'One workspace for these repos',
    instruction: 'Create the workspace so Goodboy can work on the repositories it found.',
    outcome: 'workspace-created',
    anchor: WORKSPACE_CREATE,
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'workspace' }),
    doneWhen: isPastStep({ step: 'workspace' }),
  },
  {
    id: 'setup-tools',
    copy: 'Sample tools connected',
    instruction: 'Click Continue: the sample tools are connected, so agents can use them.',
    outcome: 'tools-tried',
    anchor: '[data-step="tools"] [data-demo-anchor="setup-continue"]',
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'tools' }),
    doneWhen: isPastStep({ step: 'tools' }),
  },
  {
    id: 'setup-first-start',
    copy: 'Hand it to an agent',
    instruction: 'Pick a starter task and press Start: an agent takes it and answers in a session.',
    outcome: 'first-task',
    anchor: '[data-step="first-session"] [data-demo-anchor="setup-first-start"]',
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'first-session' }),
    doneWhen: ({ state }) => hasSession({ state }),
  },
];
