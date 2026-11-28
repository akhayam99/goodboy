import {
  WIZARD_STEPS,
  type WizardStepId,
} from '../../../../../features/onboarding/OnboardingWizard/wizardSteps';
import { STORY_SESSION_ID } from '../../scenes/story/storyWorld';
import type { AppStore } from '../../../../../store/store';
import type { BlockParams, DemoHint, HintCheck, HintProbe } from './demoHintTypes';
import { hasElement } from './hasElement';
import { isAnyControl } from './isAnyControl';
import { KEY_FIELD, pasteExampleKey } from './pasteExampleKey';

const WIZARD = '[aria-label="Goodboy setup"]';

type StateParams = {
  readonly state: AppStore;
};

type RootParams = {
  readonly root: Document;
};

const stepIndexOf = ({ root }: RootParams): number => {
  const step = root.querySelector(WIZARD)?.getAttribute('data-step');
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

const ISSUE = 'HBL-412';
const WIZARD_COLUMN = '[data-testid="wizard-column"]';
const CODEX_SIGN_IN = '[data-step="agents"] [data-demo-anchor="setup-agent-signin"]';
const AGENTS_CONTINUE = '[data-step="agents"] [data-demo-anchor="setup-continue"]';
const WORKSPACE_CREATE = '[data-step="workspace"] [data-demo-anchor="setup-create"]';
const OPEN_TOOLS = '[data-step="first-session"] [data-demo-anchor="setup-open-tools"]';
const LINEAR_CONNECT = '[data-step="tools"] button[aria-label="Connect Linear"]';
const TOOLS_CONTINUE = '[data-step="tools"] [data-demo-anchor="setup-continue"]';
const TASK_ROW = `[role="option"][aria-label^="${ISSUE} "]`;
const START_SESSION = '[data-demo-anchor="task-start"]';
const START = '[data-demo-anchor="draft-start"]';
const OPTION = '[role="option"]';

const hasCodex = ({ state }: StateParams): boolean =>
  state.providers.some(
    (provider) => provider.id === 'codex' && provider.connection === 'connected',
  );

const hasLinear = ({ state }: StateParams): boolean =>
  Object.values(state.workspaceIntegrations)
    .flat()
    .some((binding) => binding.provider === 'linear');

const sessionIdsOf = ({ state }: StateParams): ReadonlySet<string> =>
  new Set(state.sessions.map((session) => session.id));

const hasNewIssueSession = ({ state, start }: HintProbe): boolean => {
  const known = sessionIdsOf({ state: start });
  return state.sessions.some(
    (session) =>
      !known.has(session.id) &&
      (state.sessionExternalTasks[session.id] ?? []).some((task) => task.identifier === ISSUE),
  );
};

const hasStoryQuestion = ({ state }: StateParams): boolean =>
  (state.sessionOpenQuestions[STORY_SESSION_ID] ?? []).length > 0;

const hasStartedAndAsked = ({ state, start, root, isAnchorClicked }: HintProbe): boolean =>
  hasNewIssueSession({ state, start, root, isAnchorClicked }) && hasStoryQuestion({ state });

const isTaskRowSelected = ({ root }: RootParams): boolean =>
  root.querySelector(TASK_ROW)?.getAttribute('aria-selected') === 'true';

const isOffPath = ({ target }: BlockParams): boolean =>
  isAnyControl({ target }) || target.closest(OPTION) !== null;

type AllowedParams = {
  readonly allowed: string;
};

const isOffTarget =
  ({ allowed }: AllowedParams) =>
  ({ target }: BlockParams): boolean =>
    target.closest(allowed) === null && isOffPath({ target });

const REOPEN = {
  copy: 'Reopen HBL-412',
  instruction: 'Press HBL-412 to open it again and go on.',
  side: 'right',
} as const satisfies DemoHint['recovery'];

const startSessionAnchorOf = ({ root }: RootParams): string | null =>
  isTaskRowSelected({ root }) && hasElement({ root, selector: START_SESSION })
    ? START_SESSION
    : null;

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
    isBlocked: isOffTarget({ allowed: CODEX_SIGN_IN }),
    revealWhen: ({ root }) => hasElement({ root, selector: CODEX_SIGN_IN }),
    doneWhen: ({ state, start }) => hasCodex({ state }) && !hasCodex({ state: start }),
  },
  {
    id: 'setup-agents',
    label: 'Keep Claude as default',
    copy: 'Continue with Claude',
    instruction: 'Press **Continue** to keep Claude as your default agent.',
    result: 'Claude stays your default agent.',
    beat: 0,
    anchor: AGENTS_CONTINUE,
    focus: WIZARD_COLUMN,
    isBlocked: isOffTarget({ allowed: AGENTS_CONTINUE }),
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
    isBlocked: isOffTarget({ allowed: WORKSPACE_CREATE }),
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
    isBlocked: isOffTarget({ allowed: OPEN_TOOLS }),
    revealWhen: ({ root }) => hasElement({ root, selector: OPEN_TOOLS }),
    doneWhen: isOnStep({ step: 'tools' }),
  },
  {
    id: 'setup-linear',
    label: 'Open Linear',
    copy: 'Connect Linear',
    instruction: 'Press **Connect** on Linear to bring its issues into Goodboy.',
    result: 'Linear asks for an API key.',
    beat: 0,
    anchor: LINEAR_CONNECT,
    focus: WIZARD_COLUMN,
    isBlocked: isOffTarget({ allowed: LINEAR_CONNECT }),
    revealWhen: ({ root }) => hasElement({ root, selector: LINEAR_CONNECT }),
    doneWhen: ({ root }) => hasElement({ root, selector: KEY_FIELD }),
  },
  {
    id: 'bring-connect',
    label: 'Add the Linear key',
    copy: 'Connect with a demo key',
    instruction: 'Press **Paste example key** to connect Linear with a demo key.',
    result: 'Linear is **Ready**, and its issues can be read here.',
    beat: 0,
    anchor: KEY_FIELD,
    focus: WIZARD_COLUMN,
    side: 'right',
    compactSide: 'top',
    isBlocked: isOffPath,
    offer: {
      eyebrow: 'Demo',
      title: 'Paste the example key',
      note: 'A demo key, it only works here',
      label: 'Paste example key',
      run: pasteExampleKey,
    },
    revealWhen: ({ root }) => hasElement({ root, selector: KEY_FIELD }),
    doneWhen: ({ state, start }) => hasLinear({ state }) && !hasLinear({ state: start }),
  },
  {
    id: 'setup-tools',
    label: 'Open your tasks',
    copy: 'Continue to your tasks',
    instruction: "Press **Continue** to see everything Harborline's tools sent.",
    result: 'Tasks lists 11 items from five tools. The new ones are marked.',
    beat: 0,
    anchor: TOOLS_CONTINUE,
    focus: WIZARD_COLUMN,
    isDimmed: false,
    isBlocked: isOffTarget({ allowed: TOOLS_CONTINUE }),
    revealWhen: ({ root, state }) =>
      hasLinear({ state }) && hasElement({ root, selector: TOOLS_CONTINUE }),
    doneWhen: ({ root }) =>
      !hasElement({ root, selector: WIZARD }) && hasElement({ root, selector: TASK_ROW }),
  },
  {
    id: 'bring-open',
    label: 'Open HBL-412',
    copy: 'Open the duplicate credit bug',
    instruction: 'Press **HBL-412** to read the duplicate credit bug.',
    result: 'HBL-412 is open, with the description of the duplicate credit.',
    beat: 0,
    anchor: TASK_ROW,
    side: 'right',
    isBlocked: isOffPath,
    revealWhen: ({ root }) =>
      !hasElement({ root, selector: WIZARD }) && hasElement({ root, selector: TASK_ROW }),
    doneWhen: ({ root }) => isTaskRowSelected({ root }),
  },
  {
    id: 'bring-session',
    label: 'Start session',
    copy: 'Hand it to your agents',
    instruction: 'Press **Start session** to hand HBL-412 to your agents.',
    result: 'A new session opens, and the brief is written from HBL-412.',
    beat: 0,
    anchor: ({ root }) => startSessionAnchorOf({ root }),
    recoveryAnchor: TASK_ROW,
    recovery: REOPEN,
    isBlocked: isOffPath,
    revealWhen: ({ root }) =>
      hasElement({ root, selector: START_SESSION }) || hasElement({ root, selector: TASK_ROW }),
    doneWhen: ({ state }) => state.openSessionDraftWorkspaceId !== null,
  },
  {
    id: 'bring-start',
    label: 'Start work',
    copy: 'Start work on this issue',
    instruction: 'Press **Start** to begin work on HBL-412.',
    progressCopy: 'The Lead is handing it to a planner',
    progress: 'The Lead reads HBL-412, hands it to a planner, and the planner reads the code.',
    result: 'Work started. The Lead hands it to a planner, which has one question first.',
    beat: 0,
    isDimmed: false,
    anchor: START,
    side: 'top',
    isBlocked: isOffPath,
    revealWhen: ({ root }) => hasElement({ root, selector: START }),
    doneWhen: hasStartedAndAsked,
  },
];
