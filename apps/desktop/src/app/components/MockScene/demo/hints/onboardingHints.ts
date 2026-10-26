import {
  WIZARD_STEPS,
  type WizardStepId,
} from '../../../../../features/onboarding/OnboardingWizard/wizardSteps';
import type { AppStore } from '../../../../../store/store';
import type { DemoHint, HintCheck } from './demoHintTypes';
import { hasElement } from './hasElement';

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

const hasLinear = ({ state }: StateParams): boolean =>
  Object.values(state.workspaceIntegrations)
    .flat()
    .some((binding) => binding.provider === 'linear');

const WIZARD_COLUMN = '[data-testid="wizard-column"]';
const WELCOME = '[data-testid="welcome-cover"]';
const WORKSPACE_CREATE = '[data-step="workspace"] [data-demo-anchor="setup-create"]';
const LINEAR_CONNECT = '[data-step="tools"] button[aria-label="Connect Linear"]';
const STARTERS = '[data-step="first-session"] [role="group"][aria-label="Starters"]';
const BUG_STARTER = 'Find one small bug';

const bugStarterIndexOf = ({ root }: RootParams): number =>
  [...root.querySelectorAll(`${STARTERS} > button`)].findIndex(
    (starter) => starter.textContent === BUG_STARTER,
  );

const bugStarterOf = ({ root }: RootParams): string | null => {
  const index = bugStarterIndexOf({ root });
  return index < 0 ? null : `${STARTERS} > button:nth-of-type(${index + 1})`;
};

const isBugStarterPicked = ({ root }: RootParams): boolean => {
  const selector = bugStarterOf({ root });
  return selector !== null && root.querySelector(selector)?.getAttribute('aria-pressed') === 'true';
};

const isIssueTabPicked = ({ root }: RootParams): boolean =>
  root.querySelector('[data-step="first-session"] [role="tab"][aria-selected="true"]')
    ?.textContent === 'Pick up an issue';

const isFirstSession = ({ root }: RootParams): boolean =>
  stepIndexOf({ root }) === WIZARD_STEPS.indexOf('first-session');

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
    instruction: 'Click Continue to keep Claude and Codex and move on to your code.',
    result: 'Claude and Codex are kept: either one can take a task.',
    beat: 0,
    anchor: '[data-step="agents"] [data-demo-anchor="setup-continue"]',
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'agents' }),
    doneWhen: isPastStep({ step: 'agents' }),
  },
  {
    id: 'setup-workspace',
    label: 'Choose the folder',
    copy: 'Point it at the code',
    instruction: 'Click Choose folder and pick the Harborline folder with the three repositories.',
    result: 'payments-api, ledger-core and notify-relay are in that folder.',
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
    instruction: 'Click Create workspace so Goodboy can work on the three repositories together.',
    result: 'The workspace holds payments-api, ledger-core and notify-relay.',
    beat: 0,
    anchor: WORKSPACE_CREATE,
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'workspace' }),
    doneWhen: isPastStep({ step: 'workspace' }),
  },
  {
    id: 'setup-linear',
    label: 'Connect Linear',
    copy: 'Connect your tracker',
    instruction: 'Click Connect on Linear: agents can then start a session from one of its issues.',
    result: 'Linear is connected: its issues can start a session.',
    beat: 0,
    anchor: LINEAR_CONNECT,
    focus: WIZARD_COLUMN,
    revealWhen: ({ root }) => hasElement({ root, selector: LINEAR_CONNECT }),
    doneWhen: ({ state, start }) => hasLinear({ state }) && !hasLinear({ state: start }),
  },
  {
    id: 'setup-tools',
    label: 'Keep the tools',
    copy: 'Keep GitHub and Linear',
    instruction: 'Click Continue to keep GitHub and Linear for this workspace.',
    result: 'GitHub and Linear are set for this workspace.',
    beat: 0,
    anchor: '[data-step="tools"] [data-demo-anchor="setup-continue"]',
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'tools' }),
    doneWhen: isPastStep({ step: 'tools' }),
  },
  {
    id: 'setup-bug',
    label: 'Pick the bug starter',
    copy: 'Pick the bug starter',
    instruction: 'Pick Find one small bug: a read-only agent will look for it in payments-api.',
    result: 'The first task is set: a read-only agent takes it.',
    beat: 0,
    anchor: ({ root }) => bugStarterOf({ root }),
    focus: WIZARD_COLUMN,
    revealWhen: ({ root }) => isFirstSession({ root }),
    doneWhen: ({ root, state }) =>
      isBugStarterPicked({ root }) || isIssueTabPicked({ root }) || hasSession({ state }),
  },
  {
    id: 'setup-first-start',
    label: 'Start the first task',
    copy: 'Start the first task',
    instruction: 'Press Start: the agent reads payments-api and answers in a new session.',
    result: 'Scout is reading payments-api in a new session. It changes nothing.',
    beat: 0,
    anchor: '[data-step="first-session"] [data-demo-anchor="setup-first-start"]',
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'first-session' }),
    doneWhen: ({ state }) => hasSession({ state }),
  },
];
