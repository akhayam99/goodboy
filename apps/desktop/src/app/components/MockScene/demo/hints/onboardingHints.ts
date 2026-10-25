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

const WORKSPACE_CREATE = '[data-step="workspace"] [data-demo-anchor="setup-create"]';

export const ONBOARDING_HINTS: ReadonlyArray<DemoHint> = [
  {
    id: 'setup-start',
    copy: 'See the agents ready to use',
    outcome: 'setup-opened',
    anchor: '[data-step="welcome"] [data-demo-anchor="setup-start"]',
    revealWhen: isOnStep({ step: 'welcome' }),
    doneWhen: isPastStep({ step: 'welcome' }),
  },
  {
    id: 'setup-agents',
    copy: 'Continue with your ready agents',
    outcome: 'agents-ready',
    anchor: '[data-step="agents"] [data-demo-anchor="setup-continue"]',
    revealWhen: isOnStep({ step: 'agents' }),
    doneWhen: isPastStep({ step: 'agents' }),
  },
  {
    id: 'setup-workspace',
    copy: 'Choose the sample Harborline folder',
    outcome: null,
    anchor: '[data-step="workspace"] [data-demo-anchor="setup-choose-folder"]',
    revealWhen: isOnStep({ step: 'workspace' }),
    doneWhen: ({ root }) =>
      root.querySelector(WORKSPACE_CREATE) !== null ||
      stepIndexOf({ root }) > WIZARD_STEPS.indexOf('workspace'),
  },
  {
    id: 'setup-create',
    copy: 'Create a workspace from these repositories',
    outcome: 'workspace-created',
    anchor: WORKSPACE_CREATE,
    revealWhen: isOnStep({ step: 'workspace' }),
    doneWhen: isPastStep({ step: 'workspace' }),
  },
  {
    id: 'setup-tools',
    copy: 'Sample tools are ready. Continue',
    outcome: 'tools-tried',
    anchor: '[data-step="tools"] [data-demo-anchor="setup-continue"]',
    revealWhen: isOnStep({ step: 'tools' }),
    doneWhen: isPastStep({ step: 'tools' }),
  },
  {
    id: 'setup-first-start',
    copy: 'Pick a starter task, then start it',
    outcome: 'first-task',
    anchor: '[data-step="first-session"] [data-demo-anchor="setup-first-start"]',
    revealWhen: isOnStep({ step: 'first-session' }),
    doneWhen: ({ state }) => hasSession({ state }),
  },
  {
    id: 'setup-done',
    copy: 'Scout answered your first task. You are set up',
    outcome: null,
    anchor: 'textarea[aria-label="Message to the agent"]',
    side: 'left',
    nextChapterId: 'agent',
    revealWhen: ({ state }) => isFirstTaskAnswered({ state }),
    doneWhen: () => false,
  },
];
