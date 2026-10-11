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
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
import { aPlan, aStoredPlan } from '../../../../test/planFixtures';

const storeState: Record<string, unknown> = {};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

import { OrchestratorStrip } from './index';
import { requestStepRouting } from '../../requestStepRouting';
import { useOrchestratorState } from '../../useOrchestratorState';
import { useRunPlan } from '../../useRunPlan';

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

type HarnessProps = {
  readonly run: WorkflowRun;
  readonly agents: ReadonlyArray<Agent>;
  readonly steps: ReadonlyArray<Step>;
  readonly costUsd: number;
  readonly isOrchestrating: boolean;
};

const StripHarness = ({ run: shownRun, agents, steps, costUsd, isOrchestrating }: HarnessProps) => {
  const plan = useRunPlan({ sessionId: SESSION_ID, runId: shownRun.id });
  const { state } = useOrchestratorState({
    sessionId: SESSION_ID,
    run: shownRun,
    agents,
    plan,
    isOrchestrating,
    costUsd,
  });
  return (
    <OrchestratorStrip
      sessionId={SESSION_ID}
      run={shownRun}
      agents={agents}
      steps={steps}
      state={state}
      isOrchestrating={isOrchestrating}
    />
  );
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
      <StripHarness
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
  it('says the run is ready to plan the first step and draws no button of its own', () => {
    renderStrip();

    expect(sentence()).toContain('Ready to plan the first step');
    expect(screen.queryByRole('button', { name: 'Decide next step' })).toBeNull();
    expect(
      screen.getByTestId('orchestrator-strip').querySelectorAll('[data-variant="primary"]'),
    ).toHaveLength(0);
  });

  it('says where the run got to and waits for your go', () => {
    renderStrip({ agents: [agent(0, 'completed'), agent(1, 'completed')] });

    expect(sentence()).toContain('Waiting for your go');
  });

  it('offers no next step control while autorun drives the run', () => {
    renderStrip({ runOverride: run({ autoRun: true }), agents: [agent(0, 'completed')] });

    expect(sentence()).toContain('Continuing automatically');
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
  });

  it('pulses on its rail while it decides, with no manual control', () => {
    renderStrip({ isOrchestrating: true });

    expect(sentence()).toContain('Choosing the next step');
    expect(screen.getByTestId('tone-bar').getAttribute('data-tone')).toBe('info');
    expect(screen.getByRole('img', { name: sentence() })).toBeDefined();
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

  it('says the plan is ready and offers no plan button, which the header owns', () => {
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
    expect(screen.queryByRole('button', { name: 'Open plan' })).toBeNull();
    expect(useAppStore.getState().drawer).toBeNull();
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

  it('says what the planner asked and leaves Answer to the header', () => {
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
    expect(screen.queryByRole('button', { name: 'Answer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Review plan' })).toBeNull();
  });

  it('names a gating question nobody asked', () => {
    Object.assign(storeState, {
      sessionOpenQuestions: {
        [SESSION_ID]: [{ id: 'q-1', status: 'open', workflowRunId: RUN_ID }],
      },
    });
    renderStrip({ agents: [agent(0, 'completed')] });

    expect(sentence()).toBe('Paused for your answer');
    expect(screen.queryByRole('button', { name: 'Answer' })).toBeNull();
  });

  it('says which running step asked', () => {
    Object.assign(storeState, {
      sessionOpenQuestions: {
        [SESSION_ID]: [
          {
            id: 'q-scout',
            status: 'open',
            workflowRunId: RUN_ID,
            createdByAgentId: 'agent-0',
            text: 'Should /diaries stay as an alias?',
          },
        ],
      },
    });
    renderStrip({
      runOverride: run({ autoRun: true }),
      agents: [
        agent(0, 'running', { name: 'Scout the diaries area' }),
        agent(1, 'completed', {
          name: 'api clinical tests module',
          parentAgentId: 'agent-0' as AgentId,
        }),
      ],
    });

    expect(sentence()).toBe('Paused for your answer · step 1 · Scout the diaries area');
    expect(screen.getByTestId('orchestrator-strip').getAttribute('data-phase')).toBe(
      'needs-answer',
    );
  });

  it('keeps Waiting on step when the running step has no question to answer', () => {
    renderStrip({
      runOverride: run({ autoRun: true }),
      agents: [agent(0, 'running', { name: 'Scout the diaries area' })],
    });

    expect(sentence()).toBe('Waiting on step 1 · Scout the diaries area');
    expect(screen.queryByRole('button', { name: 'Answer' })).toBeNull();
  });

  it('reads a budget pause as a pause, not as a failure, and holds no spend cap control', () => {
    renderStrip({
      runOverride: run({
        orchestrationStop: {
          kind: 'budget',
          message: 'Paused at the $12.00 spend cap for this run.',
        },
      }),
    });

    expect(sentence()).toBe('Paused at the $12.00 spend cap for this run.');
    expect(screen.queryByTestId('run-spend-limit-trigger')).toBeNull();
  });

  it('reads a budget pause worded differently as a pause all the same', () => {
    renderStrip({
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'any other wording' } }),
    });

    expect(sentence()).toBe('Paused at the spend cap');
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
  });

  it('waits for your go once the question behind the stop is answered', () => {
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
  });

  it('reads an operator stop as a stop', () => {
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

  it('shows the failure with its reason', () => {
    renderStrip({
      runOverride: run({
        orchestrationStop: {
          kind: 'failure',
          message: 'usage limit reached (anthropic/haiku-4.5)',
        },
      }),
    });

    expect(sentence()).toContain('Last decision failed');
    expect(screen.getByTestId('orchestrator-detail').textContent).toContain('usage limit reached');
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
  });

  it('closes a complete run with its step count and spend', () => {
    renderStrip({
      runOverride: run({ orchestrationOutcome: 'done' }),
      agents: [agent(0, 'completed'), agent(1, 'completed'), agent(2, 'completed')],
      costUsd: 1.28,
    });

    expect(sentence()).toContain('Run complete · 3 steps · $1.28');
  });
});

describe('OrchestratorStrip draws no action of its own', () => {
  const HELD_STOP = { kind: 'plan-approval', message: 'The plan is ready.' } as const;
  const SCENARIOS: ReadonlyArray<{
    readonly name: string;
    readonly runOverride: WorkflowRun;
  }> = [
    { name: 'ready to plan', runOverride: run() },
    { name: 'held for its plan', runOverride: run({ orchestrationStop: HELD_STOP }) },
    {
      name: 'paused by you',
      runOverride: run({ orchestrationStop: { kind: 'paused', message: 'paused' } }),
    },
    {
      name: 'stopped by you',
      runOverride: run({ orchestrationStop: { kind: 'operator', message: 'stopped' } }),
    },
    {
      name: 'failed',
      runOverride: run({ orchestrationStop: { kind: 'failure', message: 'usage limit' } }),
    },
    {
      name: 'paused at the spend cap',
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'cap reached' } }),
    },
    { name: 'complete', runOverride: run({ orchestrationOutcome: 'done' }) },
    { name: 'blocked', runOverride: run({ orchestrationOutcome: 'blocked' }) },
  ];

  it.each(SCENARIOS)(
    'keeps the status line of a run $name free of buttons and menus',
    (scenario) => {
      renderStrip({ runOverride: scenario.runOverride, agents: [agent(0, 'completed')] });

      const strip = screen.getByTestId('orchestrator-strip');
      expect(strip.querySelectorAll('[data-variant="primary"]')).toHaveLength(0);
      expect(
        within(strip)
          .queryAllByRole('button')
          .map((button) => button.getAttribute('aria-label') ?? button.textContent ?? '')
          .filter((name) => !/^Orchestrator routing/.test(name)),
      ).toEqual([]);
      expect(within(strip).queryByRole('menu')).toBeNull();
    },
  );
});

describe('OrchestratorStrip layout', () => {
  it('reads as one row with the model, and keeps the hint field for the dock', () => {
    renderStrip({ agents: [agent(0, 'running')], runOverride: run({ autoRun: true }) });

    const row = screen.getByTestId('orchestrator-strip-row');
    expect(row.contains(screen.getByTestId('orchestrator-routing'))).toBe(true);
    expect(screen.queryByRole('button', { name: 'Orchestrator actions' })).toBeNull();
    expect(screen.queryByTestId('orchestrator-hint-input')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'Run on its own' })).toBeNull();
  });

  it('opens the model per step panel when the run is asked to show its routing', () => {
    const running = agent(0, 'running', { name: 'Scout the parser' });
    Object.assign(storeState, {
      sessionPhaseRuns: { [SESSION_ID]: [running] },
      workflowNodeRoutingPending: {},
      workflowNodeRoutingErrors: {},
    });
    renderStrip({ agents: [running], runOverride: run({ autoRun: true }) });

    expect(screen.queryByRole('region', { name: 'Model per step' })).toBeNull();
    act(() => requestStepRouting({ runId: RUN_ID }));

    expect(screen.getByRole('region', { name: 'Model per step' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Hide model per step' }));
    expect(screen.queryByRole('region', { name: 'Model per step' })).toBeNull();
  });

  it('ignores a routing request that names another run', () => {
    const running = agent(0, 'running', { name: 'Scout the parser' });
    Object.assign(storeState, {
      sessionPhaseRuns: { [SESSION_ID]: [running] },
      workflowNodeRoutingPending: {},
      workflowNodeRoutingErrors: {},
    });
    renderStrip({ agents: [running], runOverride: run({ autoRun: true }) });

    act(() => requestStepRouting({ runId: 'run-other' as WorkflowRunId }));

    expect(screen.queryByRole('region', { name: 'Model per step' })).toBeNull();
  });

  it('offers no Decide next step while autorun is on, even before the first step', () => {
    renderStrip({ runOverride: run({ autoRun: true }) });

    expect(sentence()).toContain('Continuing automatically');
  });
});

describe('OrchestratorStrip hints', () => {
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

  it('keeps the spend cap out of the state sentence', () => {
    renderStrip({ runOverride: run({ spendLimitUsd: 12, spendLimitMode: 'notify' }) });

    expect(screen.queryByTestId('orchestrator-spend-limit')).toBeNull();
    expect(screen.getByTestId('orchestrator-strip').textContent).not.toContain('Spend cap');
  });

  it('leaves the reasons for each step to the section under the goal', () => {
    renderStrip({ steps: [step(0, 'the codebase is unknown'), step(1, 'the plan is settled')] });

    expect(screen.queryByText(/the codebase is unknown/u)).toBeNull();
  });
});
