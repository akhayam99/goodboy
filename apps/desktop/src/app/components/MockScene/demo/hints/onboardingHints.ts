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

const isFirstTaskAnswered = ({ state }: StateParams): boolean => {
  const sessionId = state.currentSessionId;
  if (sessionId === null || !hasSession({ state })) {
    return false;
  }
  const agentId = state.selectedAgentId[sessionId];
  if (agentId === null || agentId === undefined) {
    return false;
  }
  const isBusy = state.agentTurnState[agentId]?.kind === 'running';
  const isStopped = (state.sessionPhaseRuns[sessionId] ?? []).some(
    (agent) => agent.id === agentId && agent.status === 'stopped',
  );
  return (
    !isBusy &&
    !isStopped &&
    (state.transcripts[agentId] ?? []).some((event) => event.kind === 'done')
  );
};

const WIZARD_COLUMN = '[data-testid="wizard-column"]';
const WELCOME = '[data-testid="welcome-cover"]';
const WORKSPACE_CREATE = '[data-step="workspace"] [data-demo-anchor="setup-create"]';

export const ONBOARDING_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'setup-start',
    copy: 'Press Get started to begin a one minute setup',
    outcome: 'setup-opened',
    anchor: '[data-step="welcome"] [data-demo-anchor="setup-start"]',
    focus: WELCOME,
    revealWhen: isOnStep({ step: 'welcome' }),
    doneWhen: isPastStep({ step: 'welcome' }),
  },
  {
    id: 'setup-agents',
    copy: 'Press Continue: these agents are ready to use',
    outcome: 'agents-ready',
    anchor: '[data-step="agents"] [data-demo-anchor="setup-continue"]',
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'agents' }),
    doneWhen: isPastStep({ step: 'agents' }),
  },
  {
    id: 'setup-workspace',
    copy: 'Press Choose folder to add the sample Harborline code',
    outcome: null,
    anchor: '[data-step="workspace"] [data-demo-anchor="setup-choose-folder"]',
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'workspace' }),
    doneWhen: (probe) =>
      probe.root.querySelector(WORKSPACE_CREATE) !== null ||
      isPastStep({ step: 'workspace' })(probe),
  },
  {
    id: 'setup-create',
    copy: 'Create the workspace so Goodboy can work on these repositories',
    outcome: 'workspace-created',
    anchor: WORKSPACE_CREATE,
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'workspace' }),
    doneWhen: isPastStep({ step: 'workspace' }),
  },
  {
    id: 'setup-tools',
    copy: 'Press Continue: the sample tools are connected',
    outcome: 'tools-tried',
    anchor: '[data-step="tools"] [data-demo-anchor="setup-continue"]',
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'tools' }),
    doneWhen: isPastStep({ step: 'tools' }),
  },
  {
    id: 'setup-first-start',
    copy: 'Pick a starter task, then press Start to hand it to an agent',
    outcome: 'first-task',
    anchor: '[data-step="first-session"] [data-demo-anchor="setup-first-start"]',
    focus: WIZARD_COLUMN,
    revealWhen: isOnStep({ step: 'first-session' }),
    doneWhen: ({ state }) => hasSession({ state }),
  },
  {
    id: 'setup-done',
    copy: 'Scout answered your first task. Setup is done.',
    outcome: null,
    anchor: 'textarea[aria-label="Message to the agent"]',
    side: 'left',
    nextChapterId: 'agent',
    revealWhen: ({ state }) => isFirstTaskAnswered({ state }),
    doneWhen: () => false,
  },
];
