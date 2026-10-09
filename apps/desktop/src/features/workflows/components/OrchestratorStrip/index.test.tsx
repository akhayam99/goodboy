// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  ArtifactId,
  IsoDateTime,
  MeasuredTurnSpan,
  OpenQuestion,
  OpenQuestionId,
  OrchestratorHint,
  ProviderRunId,
  SessionId,
  Step,
  StepId,
  TurnState,
  WorkflowId,
  WorkflowOrchestrationStop,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import type { AppStore } from '../../../../store/store';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';

import { WorkTimeContext, type WorkTimeSource } from '../../../workTreeModel/workTimeSource';
import { agentPlace } from '../../../../store';
import { aPlan, aStoredPlan } from '../../../../test/planFixtures';

const storeState: Record<string, unknown> = {};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

import { OrchestratorStrip } from './index';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;

const run = (overrides: Partial<WorkflowRun> = {}): WorkflowRun => ({
  id: RUN_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode: 'dynamic',
  ...overrides,
});

const agent = (
  ordinal: number,
  status: Agent['status'],
  overrides: Partial<Agent> = {},
): Agent => ({
  id: `agent-${ordinal}` as AgentId,
  sessionId: SESSION_ID,
  stepId: `step-${ordinal}` as StepId,
  workflowRunId: RUN_ID,
  ordinal,
  name: `step ${ordinal}`,
  status,
  ...overrides,
});

const step = (ordinal: number, orchestratorReason: string): Step =>
  ({
    id: `step-${ordinal}` as StepId,
    workflowId: WORKFLOW_ID,
    ordinal,
    name: `step ${ordinal}`,
    promptPrefix: '',
    orchestratorReason,
  }) as Step;

const PLAN = aPlan({
  id: 'plan-ledger' as ArtifactId,
  sessionId: SESSION_ID,
  agentId: 'agent-0' as AgentId,
  workflowRunId: RUN_ID,
});

const REVISING_TURN: TurnState = {
  kind: 'running',
  runId: 'run-revise' as ProviderRunId,
  startedAt: '2026-09-23T10:05:00.000Z' as IsoDateTime,
};

const ASKING_TURN: TurnState = {
  kind: 'blocked',
  runId: 'run-revise' as ProviderRunId,
  blockedAt: '2026-09-23T10:05:00.000Z' as IsoDateTime,
};

const STORED_PLAN = aStoredPlan({ sessionId: SESSION_ID, agentId: PLAN.agentId }, PLAN);

const openQuestion = (): OpenQuestion => ({
  id: 'oq-1' as OpenQuestionId,
  sessionId: SESSION_ID,
  workflowRunId: RUN_ID,
  text: 'which database?',
  suggestedAnswers: [],
  isBlocking: false,
  userAnswer: null,
  status: 'open',
  createdAt: '2025-01-01T00:00:00.000Z' as IsoDateTime,
});

const EMPTY_AGENTS: ReadonlyArray<Agent> = [];
const EMPTY_STEPS: ReadonlyArray<Step> = [];

type RenderParams = {
  readonly runOverride?: WorkflowRun;
  readonly agents?: ReadonlyArray<Agent>;
  readonly steps?: ReadonlyArray<Step>;
  readonly costUsd?: number;
  readonly isOrchestrating?: boolean;
  readonly source?: WorkTimeSource | null;
};

const renderStrip = ({
  runOverride = run(),
  agents = EMPTY_AGENTS,
  steps = EMPTY_STEPS,
  costUsd = 0,
  isOrchestrating = false,
  source = null,
}: RenderParams = {}) => {
  useAppStore.setState(storeState as Partial<AppStore>);
  return render(
    <WorkTimeContext.Provider value={source}>
      <OrchestratorStrip
        sessionId={SESSION_ID}
        run={runOverride}
        agents={agents}
        steps={steps}
        costUsd={costUsd}
        isOrchestrating={isOrchestrating}
      />
    </WorkTimeContext.Provider>,
  );
};

const HINT_AT = '2026-09-23T10:00:00.000Z' as IsoDateTime;

const hint = (over: Partial<OrchestratorHint>): OrchestratorHint => ({
  id: 'hint',
  text: 'keep it to one PR',
  createdAt: HINT_AT,
  ...over,
});

const sentence = () => screen.getByTestId('orchestrator-state').textContent ?? '';

const openMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Orchestrator actions' }));
};

beforeEach(async () => {
  await resetStoryStore();
  Object.assign(storeState, {
    orchestrateNextStep: vi.fn(async () => undefined),
    retryWorkflowOrchestration: vi.fn(async () => undefined),
    continueWorkflowRun: vi.fn(async () => undefined),
    addWorkflowOrchestratorHint: vi.fn(async () => undefined),
    removeWorkflowOrchestratorHint: vi.fn(async () => undefined),
    setWorkflowOrchestratorRouting: vi.fn(async () => undefined),
    setWorkflowRunAutonomy: vi.fn(async () => undefined),
    stopWorkflowRunNow: vi.fn(async () => undefined),
    navigate: vi.fn(),
    requestOpenQuestionScroll: vi.fn(),
    pauseWorkflowRun: vi.fn(async () => undefined),
    resumeWorkflowRun: vi.fn(async () => undefined),
    approveWorkflowRunPlan: vi.fn(async () => undefined),
    setWorkflowRunSpendLimit: vi.fn(async () => undefined),
    sessionOpenQuestions: {},
    orchestratorReadingHints: {},
    workflowRunAttachments: {},
    loadGoalAttachments: vi.fn(async () => undefined),
    budgetAlerts: [],
    sessionBudgets: {},
    sessionTelemetry: {},
    sessionPhaseRuns: {},
    agentRunHistory: {},
    sessions: [],
    workspaceOverrides: {},
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'missing' },
    ],
    cliRequirements: [],
  });
});

afterEach(cleanup);

describe('OrchestratorStrip state ladder', () => {
  it('asks for the first step on a run that has not started', () => {
    renderStrip();

    expect(sentence()).toContain('Ready to plan the first step');
    expect(screen.getByTestId('workflow-orchestrate-next-cta').textContent).toContain(
      'Decide next step',
    );
    fireEvent.click(screen.getByTestId('workflow-orchestrate-next-cta'));

    expect(storeState['orchestrateNextStep']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('says where the run got to before offering the next decision', () => {
    renderStrip({ agents: [agent(0, 'completed'), agent(1, 'completed')] });

    expect(sentence()).toContain('Waiting for your go');
    fireEvent.click(screen.getByTestId('workflow-orchestrate-next-cta'));

    expect(storeState['orchestrateNextStep']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });
  it('offers no next step control while autorun drives the run', () => {
    renderStrip({ runOverride: run({ autoRun: true }), agents: [agent(0, 'completed')] });

    expect(sentence()).toContain('Continuing automatically');
    expect(screen.queryByTestId('workflow-orchestrate-next-cta')).toBeNull();
  });

  it('says a step failed instead of claiming autorun is still continuing', () => {
    renderStrip({
      runOverride: run({ autoRun: true }),
      agents: [agent(0, 'completed'), agent(1, 'failed', { name: 'implement the remap' })],
    });

    expect(sentence()).not.toContain('Continuing automatically');
    expect(sentence()).toBe('Paused on failed step 2');
    expect(screen.getByTestId('orchestrator-strip').getAttribute('data-phase')).toBe('step-failed');
    expect(screen.queryByTestId('orchestrator-detail')).toBeNull();
  });

  it('leaves the failed step recovery to the next action strip above it', () => {
    renderStrip({
      runOverride: run({ autoRun: true }),
      agents: [agent(0, 'completed'), agent(1, 'failed')],
    });

    expect(screen.queryByRole('button', { name: /skip/i })).toBeNull();
    expect(screen.queryByTestId('workflow-orchestrate-next-cta')).toBeNull();
    expect(screen.queryByTestId('orchestrator-retry')).toBeNull();
  });

  it('pulses on its rail while it decides, with no manual control', () => {
    renderStrip({ isOrchestrating: true });

    expect(sentence()).toContain('Choosing the next step');
    expect(screen.getByTestId('tone-bar').getAttribute('data-tone')).toBe('info');
    expect(screen.getByRole('img', { name: sentence() })).toBeDefined();
    expect(screen.queryByTestId('workflow-orchestrate-next-cta')).toBeNull();
  });

  it('names the step it waits on and the machine time it has worked', () => {
    const startedAt = new Date(Date.now() - 20 * 60_000).toISOString() as IsoDateTime;
    const measured: MeasuredTurnSpan = {
      agentId: 'agent-1' as AgentId,
      parentAgentId: null,
      agentStatus: 'running',
      workflowRunId: RUN_ID,
      isOrchestratedRunDone: false,
      stepRole: 'implementer',
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      effort: null,
      startedAtMs: 0,
      endedAtMs: 3 * 60_000,
      endReason: 'awaiting_user',
      costUsd: null,
      touchedMountIds: null,
    };
    renderStrip({
      runOverride: run({ autoRun: true }),
      agents: [
        agent(0, 'completed'),
        agent(1, 'running', { name: 'implement language-id remap', startedAt }),
      ],
      source: {
        nowMs: Date.now(),
        spans: [measured],
        history: null,
        liveStartMs: new Map(),
        childrenOf: new Map(),
      },
    });

    expect(sentence()).toContain('Waiting on step 2 · implement language-id remap');
    expect(screen.getByTestId('orchestrator-elapsed').textContent).toContain('3m');
    expect(screen.queryByTestId('workflow-orchestrate-next-cta')).toBeNull();
  });

  it('shows no time for a step that has not recorded any machine time', () => {
    renderStrip({
      runOverride: run({ autoRun: true }),
      agents: [agent(0, 'completed'), agent(1, 'running')],
    });

    expect(screen.queryByTestId('orchestrator-elapsed')).toBeNull();
  });

  it('stops the step in flight from the strip, after a confirm, and holds the run', async () => {
    renderStrip({
      runOverride: run({ autoRun: true }),
      agents: [agent(0, 'running', { name: 'implement the remap' })],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Stop step' }));
    const confirm = await screen.findByRole('group', { name: 'Stop implement the remap?' });
    expect(confirm.textContent).toContain('The step is cancelled and marked Skipped.');
    expect(confirm.textContent).toContain('What it wrote is kept.');
    expect(storeState['stopWorkflowRunNow']).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Stop step' }));

    await waitFor(() =>
      expect(storeState['stopWorkflowRunNow']).toHaveBeenCalledWith(SESSION_ID, RUN_ID),
    );
  });

  it('leaves Pause, Resume and Stop run to the header, and offers Stop step only with a step in flight', () => {
    renderStrip({ agents: [agent(0, 'running')] });

    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stop run' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Stop step' })).toBeDefined();

    cleanup();
    renderStrip({ agents: [agent(0, 'completed')] });
    expect(screen.queryByRole('button', { name: 'Stop step' })).toBeNull();
  });

  it('stops offering Stop step while a stop is already landing', () => {
    renderStrip({
      runOverride: run({ orchestrationStop: { kind: 'operator', message: 'stopped' } }),
      agents: [agent(0, 'running')],
      isOrchestrating: true,
    });

    expect(screen.queryByRole('button', { name: 'Stop step' })).toBeNull();
  });
  it('says it is paused and what finishes, and leaves Resume to the header', () => {
    renderStrip({
      runOverride: run({ autoRun: true, orchestrationStop: { kind: 'paused', message: 'paused' } }),
      agents: [agent(0, 'running', { name: 'Reviewer' })],
    });

    expect(sentence()).toBe('Paused by you');
    expect(screen.getByTestId('orchestrator-detail').textContent).toContain(
      'Reviewer finishes its turn.',
    );
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
    expect(storeState['setWorkflowRunAutonomy']).not.toHaveBeenCalled();
  });
  it('says the plan is ready and opens it from Open plan, leaving Review plan and Approve to the header', () => {
    useAppStore.setState({ sessionPlans: { [SESSION_ID]: [PLAN] } });
    renderStrip({
      runOverride: run({
        autoRun: true,
        orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
      }),
      agents: [agent(0, 'completed', { name: 'Planner' })],
    });

    expect(sentence()).toBe('Plan ready · waiting for you');
    expect(screen.queryByRole('button', { name: 'Approve plan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Review plan' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open plan' }));

    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'artifact-document',
      sessionId: SESSION_ID,
      payload: { artifactId: PLAN.id },
    });
    expect(storeState['approveWorkflowRunPlan']).not.toHaveBeenCalled();
    expect(storeState['orchestrateNextStep']).not.toHaveBeenCalled();
  });

  it('offers no Review plan when the run holds no plan to open', () => {
    renderStrip({
      runOverride: run({
        orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
      }),
      agents: [agent(0, 'completed')],
    });

    expect(sentence()).toBe('Plan ready · waiting for you');
    expect(screen.queryByRole('button', { name: 'Review plan' })).toBeNull();
  });

  it('says the planner is revising the plan, with no control until it is done', () => {
    useAppStore.setState({
      sessionPlans: { [SESSION_ID]: [PLAN] },
      sessionArtifacts: { [SESSION_ID]: [STORED_PLAN] },
      agentTurnState: { [PLAN.agentId]: REVISING_TURN },
    });
    renderStrip({
      runOverride: run({
        orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
      }),
      agents: [agent(0, 'completed', { name: 'Planner' })],
    });

    expect(sentence()).toBe('The planner is revising the plan');
    expect(screen.getByTestId('orchestrator-strip').getAttribute('data-phase')).toBe(
      'plan-revising',
    );
    expect(screen.queryByRole('button', { name: 'Review plan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Answer' })).toBeNull();
  });

  it('says what the planner asked and answers it from the strip', () => {
    useAppStore.setState({
      sessionPlans: { [SESSION_ID]: [PLAN] },
      sessionArtifacts: { [SESSION_ID]: [STORED_PLAN] },
      agentTurnState: { [PLAN.agentId]: ASKING_TURN },
    });
    Object.assign(storeState, {
      sessionOpenQuestions: {
        [SESSION_ID]: [
          {
            id: 'oq-plan',
            status: 'open',
            workflowRunId: RUN_ID,
            createdByAgentId: PLAN.agentId,
            text: 'Keep the retry window at 5 minutes?',
          },
        ],
      },
    });
    renderStrip({
      runOverride: run({
        orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
      }),
      agents: [agent(0, 'completed', { name: 'Planner' })],
    });

    expect(sentence()).toBe('The planner asked: Keep the retry window at 5 minutes?');
    expect(screen.getByTestId('orchestrator-strip').getAttribute('data-phase')).toBe(
      'plan-question',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(storeState['navigate']).toHaveBeenCalledWith({
      to: agentPlace({ sessionId: SESSION_ID, agentId: PLAN.agentId, pane: 'brief' }),
    });
    expect(screen.queryByRole('button', { name: 'Review plan' })).toBeNull();
  });
  it('names a gating question and leaves the answer to the next action strip', () => {
    Object.assign(storeState, {
      sessionOpenQuestions: {
        [SESSION_ID]: [{ id: 'q-1', status: 'open', workflowRunId: RUN_ID }],
      },
    });
    renderStrip({ agents: [agent(0, 'completed')] });

    expect(sentence()).toBe('Paused for your answer');
    expect(screen.queryByRole('button', { name: /answer/i })).toBeNull();
  });

  it('reads a budget pause as a pause, not as a failure', () => {
    renderStrip({
      runOverride: run({
        orchestrationStop: {
          kind: 'budget',
          message: 'Paused at the $12.00 spend cap for this run.',
        },
      }),
    });

    expect(sentence()).toBe('Paused at the $12.00 spend cap for this run.');
    expect(screen.queryByTestId('orchestrator-retry')).toBeNull();
    fireEvent.click(screen.getByTestId('run-spend-limit-trigger'));

    expect(screen.getByRole('dialog', { name: 'Spend cap for this run' })).toBeDefined();
  });

  it('reads a budget pause worded differently as a pause all the same', () => {
    renderStrip({
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'any other wording' } }),
    });

    expect(sentence()).toBe('Paused at the spend cap');
    expect(screen.getByTestId('run-spend-limit-trigger').textContent).toContain(
      'Raise the spend cap',
    );
  });

  it('reads a question stop as a question to answer, with no retry on offer', () => {
    storeState['sessionOpenQuestions'] = { [SESSION_ID]: [openQuestion()] };
    renderStrip({
      runOverride: run({
        orchestrationStop: {
          kind: 'questions',
          message: 'Open questions are waiting for an answer.',
        },
      }),
    });

    expect(sentence()).toBe('Paused for your answer');
    expect(screen.queryByTestId('orchestrator-retry')).toBeNull();
    expect(screen.queryByRole('button', { name: /answer/i })).toBeNull();
  });

  it('offers the next step again once the question behind the stop is answered', () => {
    renderStrip({
      runOverride: run({
        orchestrationStop: {
          kind: 'questions',
          message: 'Open questions are waiting for an answer.',
        },
      }),
      agents: [agent(0, 'completed')],
    });

    expect(sentence()).toContain('Waiting for your go');
    fireEvent.click(screen.getByTestId('workflow-orchestrate-next-cta'));

    expect(storeState['orchestrateNextStep']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });
  it('reads an operator stop as a stop, and resumes hands-free from it', () => {
    renderStrip({
      runOverride: run({
        orchestrationStop: {
          kind: 'operator',
          message: 'You stopped this run. The step in flight was skipped.',
        },
      }),
      agents: [agent(0, 'skipped')],
    });

    expect(sentence()).toContain('Stopped by you');
    expect(screen.queryByTestId('orchestrator-retry')).toBeNull();
    fireEvent.click(screen.getByTestId('orchestrator-resume'));

    expect(storeState['retryWorkflowOrchestration']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('says it is stopping instead of still choosing, when stopped mid-decision', () => {
    renderStrip({
      runOverride: run({
        orchestrationStop: {
          kind: 'operator',
          message: 'You stopped this run. The step in flight was skipped.',
        },
      }),
      agents: [agent(0, 'skipped')],
      isOrchestrating: true,
    });

    expect(sentence()).not.toContain('Choosing the next step');
    expect(sentence()).toContain('Stopping');
    expect(screen.getByTestId('orchestrator-strip').getAttribute('data-phase')).toBe('stopping');
    expect(screen.queryByTestId('orchestrator-resume')).toBeNull();

    const dot = screen.getByRole('img', { name: sentence() });
    expect(dot.className).toContain('bg-warning');
    expect(dot.className).not.toContain('bg-info');
  });

  it('falls back to a generic presentation for a stop kind it does not recognize', () => {
    renderStrip({
      runOverride: run({
        orchestrationStop: {
          kind: 'legacy-manual-hold' as WorkflowOrchestrationStop['kind'],
          message: 'written by a build this app no longer ships',
        },
      }),
    });

    expect(sentence()).toContain('Stopped · reason not recognized');
    expect(screen.getByTestId('orchestrator-detail').textContent).toContain(
      'written by a build this app no longer ships',
    );
  });

  it('shows the failure with its reason and offers a retry', () => {
    renderStrip({
      runOverride: run({
        orchestrationStop: {
          kind: 'failure',
          message: 'usage limit reached (anthropic/haiku-4.5)',
        },
      }),
    });

    expect(sentence()).toContain('Last decision failed');
    expect(screen.queryByTestId('orchestrator-review-budget')).toBeNull();
    expect(screen.getByTestId('orchestrator-detail').textContent).toContain('usage limit reached');
    fireEvent.click(screen.getByTestId('orchestrator-retry'));

    expect(storeState['retryWorkflowOrchestration']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('asks for a human call when the orchestrator stopped the run', () => {
    renderStrip({
      runOverride: run({
        orchestrationOutcome: 'blocked',
        orchestrationReason: 'the migration needs a human call',
      }),
    });

    expect(sentence()).toContain('Stopped · needs a human call');
    expect(screen.queryByTestId('orchestrator-detail')).toBeNull();
    expect(screen.queryByText('the migration needs a human call')).toBeNull();
    expect(screen.getByTestId('orchestrator-retry')).toBeDefined();
  });

  it('closes a complete run with its step count and spend, still extendable', () => {
    renderStrip({
      runOverride: run({ orchestrationOutcome: 'done' }),
      agents: [agent(0, 'completed'), agent(1, 'completed'), agent(2, 'completed')],
      costUsd: 1.28,
    });

    expect(sentence()).toContain('Run complete · 3 steps · $1.28');
    expect(screen.queryByTestId('workflow-orchestrate-next-cta')).toBeNull();

    fireEvent.click(screen.getByTestId('orchestrator-continue'));

    expect(storeState['continueWorkflowRun']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });
});

describe('OrchestratorStrip layout', () => {
  it('reads as one row with the model and the overflow, and keeps the hint field for the dock', () => {
    renderStrip({ agents: [agent(0, 'running')], runOverride: run({ autoRun: true }) });

    const row = screen.getByTestId('orchestrator-strip-row');
    expect(row.contains(screen.getByTestId('orchestrator-routing'))).toBe(true);
    expect(row.contains(screen.getByRole('button', { name: 'Orchestrator actions' }))).toBe(true);
    expect(screen.queryByTestId('orchestrator-hint-input')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Run on its own' })).toBeNull();
  });
  it('keeps when to ask and the model per step behind the overflow', () => {
    const running = agent(0, 'running', { name: 'Scout the parser' });
    Object.assign(storeState, {
      sessionPhaseRuns: { [SESSION_ID]: [running] },
      workflowNodeRoutingPending: {},
      workflowNodeRoutingErrors: {},
    });
    renderStrip({ agents: [running], runOverride: run({ autoRun: true }) });

    expect(screen.queryByRole('region', { name: 'Model per step' })).toBeNull();
    openMenu();
    expect(
      screen.getAllByRole('menuitemradio').map((item) => item.getAttribute('aria-checked')),
    ).toEqual(['false', 'false', 'true']);
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Model per step',
    ]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Model per step' }));

    expect(screen.getByRole('region', { name: 'Model per step' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Hide model per step' }));
    expect(screen.queryByRole('region', { name: 'Model per step' })).toBeNull();
  });
  it('offers when to ask before the first step, with no step to route', () => {
    renderStrip();

    openMenu();
    expect(screen.getByRole('menuitemradio', { name: 'Ask before each step' })).toBeDefined();
    expect(screen.queryByRole('menuitem', { name: 'Model per step' })).toBeNull();
  });
  it('offers no Decide next step while autorun is on, even before the first step', () => {
    renderStrip({ runOverride: run({ autoRun: true }) });

    expect(sentence()).toContain('Continuing automatically');
    expect(screen.queryByTestId('workflow-orchestrate-next-cta')).toBeNull();
  });
});

describe('OrchestratorStrip hints and money', () => {
  it('carries the routing pill on the orchestrator title row, unlabelled', () => {
    renderStrip();

    expect(screen.getByTestId('orchestrator-routing').textContent).not.toContain('decided by');
    expect(screen.queryByTestId('step-routing')).toBeNull();
  });

  it('tells a queued hint from one the decision is reading now', () => {
    storeState['orchestratorReadingHints'] = { [RUN_ID]: ['reading'] };
    renderStrip({
      isOrchestrating: true,
      runOverride: run({
        orchestratorHints: [
          hint({ id: 'reading', text: 'skip the visual suite' }),
          hint({ id: 'queued', text: 'prefer Sonnet 5 for the review' }),
        ],
      }),
    });

    expect(
      screen.getAllByTestId('orchestrator-hint-row').map((row) => row.getAttribute('data-status')),
    ).toEqual(['reading']);
    fireEvent.click(screen.getByRole('button', { name: /1 queued/ }));

    const rows = screen.getAllByTestId('orchestrator-hint-row');
    expect(rows.map((row) => row.getAttribute('data-status'))).toEqual(['queued', 'reading']);
    expect(rows[0]?.textContent).toContain('Waits for the next decision');
    expect(rows[1]?.textContent).toContain('Reading now');
    const [queuedRemove, readingRemove] = screen.getAllByRole('button', { name: 'Remove hint' });
    expect(queuedRemove?.hasAttribute('disabled')).toBe(false);
    expect(readingRemove?.hasAttribute('disabled')).toBe(true);
  });
  it('keeps read hints behind a count with the steps that read them', () => {
    renderStrip({
      runOverride: run({
        orchestratorHints: [
          hint({ id: 'read-1', text: 'keep it to one PR', consumedAt: HINT_AT, consumedAtStep: 2 }),
          hint({ id: 'read-2', text: 'map ledger first', consumedAt: HINT_AT, consumedAtStep: 3 }),
          hint({ id: 'queued', text: 'run a reviewer first' }),
        ],
      }),
    });

    expect(screen.queryAllByTestId('orchestrator-hint-row')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /1 queued/ }));
    expect(
      screen.getAllByTestId('orchestrator-hint-row').map((row) => row.getAttribute('data-status')),
    ).toEqual(['queued']);
    expect(screen.getByTestId('orchestrator-hint-read-steps').textContent).toBe(
      'Read at step 2, 3',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show read (2)' }));

    const rows = screen.getAllByTestId('orchestrator-hint-row');
    expect(rows.map((row) => row.getAttribute('data-status'))).toEqual(['queued', 'read', 'read']);
    expect(rows[1]?.textContent).toContain('Read at step 3');

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove hint' })[0]!);
    expect(storeState['removeWorkflowOrchestratorHint']).toHaveBeenCalledWith(
      SESSION_ID,
      RUN_ID,
      'queued',
    );
  });
  it('changes when to ask from the overflow', () => {
    renderStrip({ runOverride: run({ autoRun: false }), agents: [agent(0, 'completed')] });

    openMenu();
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Run on its own' }));

    expect(storeState['setWorkflowRunAutonomy']).toHaveBeenCalledWith(SESSION_ID, RUN_ID, 'run');
  });
  it('folds queued hints into one row that counts them, and opens them in place', () => {
    renderStrip({
      runOverride: run({ orchestratorHints: [hint({ id: 'queued-1' }), hint({ id: 'queued-2' })] }),
    });

    expect(sentence()).not.toContain('queued');
    expect(screen.queryAllByTestId('orchestrator-hint-row')).toHaveLength(0);
    const row = screen.getByRole('button', { name: /2 queued/ });
    expect(row.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getAllByText(/queued/)).toHaveLength(1);

    fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByTestId('orchestrator-hint-row')).toHaveLength(2);

    fireEvent.click(row);
    expect(screen.queryAllByTestId('orchestrator-hint-row')).toHaveLength(0);
  });

  it('takes no room for queued hints when there are none', () => {
    renderStrip({ runOverride: run({ orchestratorHints: [] }) });

    expect(screen.queryByTestId('orchestrator-hint-log')).toBeNull();
    expect(screen.queryByRole('button', { name: /queued/ })).toBeNull();
  });
  it('keeps money controls off the card while the run is not paused on budget', () => {
    renderStrip({ agents: [agent(0, 'completed')] });

    expect(screen.queryByTestId('orchestrator-budget')).toBeNull();
    expect(screen.queryByTestId('run-spend-limit-trigger')).toBeNull();
  });

  it('leaves one spend cap control on a budget pause and no budget button', () => {
    renderStrip({
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'cap reached' } }),
    });

    expect(screen.getAllByTestId('run-spend-limit-trigger')).toHaveLength(1);
    expect(screen.queryByTestId('orchestrator-budget')).toBeNull();
  });

  it('renders one budget control when the session budget pauses the run', () => {
    storeState['budgetAlerts'] = [{ kind: 'session-exceeded', sessionId: SESSION_ID }];
    renderStrip({
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'cap reached' } }),
    });

    expect(screen.getByTestId('orchestrator-raise-session-limit')).toBeDefined();
    expect(screen.queryByTestId('orchestrator-budget')).toBeNull();
  });

  it('keeps the spend cap out of the state sentence', () => {
    renderStrip({ runOverride: run({ spendLimitUsd: 12, spendLimitMode: 'notify' }) });

    expect(screen.queryByTestId('orchestrator-spend-limit')).toBeNull();
    expect(screen.getByTestId('orchestrator-strip').textContent).not.toContain('Spend cap');
  });

  it('sends a session limit pause to the session limit editor, not to the run limit', () => {
    storeState['budgetAlerts'] = [{ kind: 'session-exceeded', sessionId: SESSION_ID }];
    renderStrip({
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'cap reached' } }),
    });
    const opened = vi.fn();
    window.addEventListener('goodboy:edit-session-spend-limit', opened);
    fireEvent.click(screen.getByTestId('orchestrator-raise-session-limit'));
    window.removeEventListener('goodboy:edit-session-spend-limit', opened);

    expect(opened).toHaveBeenCalledTimes(1);
    expect((opened.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({ sessionId: SESSION_ID });
    expect(screen.queryByTestId('run-spend-limit-trigger')).toBeNull();
    expect(screen.queryByTestId('orchestrator-budget')).toBeNull();
  });

  it('keeps the run limit on offer when the session limit only warns', () => {
    storeState['budgetAlerts'] = [{ kind: 'session-exceeded', sessionId: SESSION_ID }];
    storeState['sessionBudgets'] = {
      [SESSION_ID]: { sessionId: SESSION_ID, softCapUsd: 5, onExceed: 'warn' },
    };
    renderStrip({
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'cap reached' } }),
    });

    expect(screen.queryByTestId('orchestrator-raise-session-limit')).toBeNull();
    expect(screen.getByTestId('run-spend-limit-trigger')).toBeDefined();
  });

  it('saves a spend cap for the run from the budget pause', () => {
    renderStrip({
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'cap reached' } }),
    });

    fireEvent.click(screen.getByTestId('run-spend-limit-trigger'));
    fireEvent.change(screen.getByTestId('spend-limit-amount'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('tab', { name: /Warn only/ }));
    fireEvent.click(screen.getByTestId('run-spend-limit-save'));

    expect(storeState['setWorkflowRunSpendLimit']).toHaveBeenCalledWith(
      SESSION_ID,
      RUN_ID,
      8,
      'notify',
    );
  });

  it('leaves the reasons for each step to the section under the goal', () => {
    renderStrip({ steps: [step(0, 'the codebase is unknown'), step(1, 'the plan is settled')] });

    expect(screen.queryByText(/the codebase is unknown/u)).toBeNull();
  });
});
