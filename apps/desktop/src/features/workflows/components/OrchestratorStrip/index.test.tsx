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
  IsoDateTime,
  MeasuredTurnSpan,
  OpenQuestion,
  OpenQuestionId,
  OrchestratorHint,
  SessionId,
  Step,
  StepId,
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
    expect(screen.getByTestId('orchestrator-strip-row').className).toContain('border-l-info');
    expect(screen.getByRole('img', { name: sentence() }).className).toContain('bg-info');
    expect(screen.queryByTestId('workflow-orchestrate-next-cta')).toBeNull();
    expect(screen.getByTestId('orchestrator-hint-input')).toBeDefined();
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

  it('confirms Stop on the strip and dispatches the hard stop', async () => {
    renderStrip({
      runOverride: run({ autoRun: true }),
      agents: [agent(0, 'running')],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    const confirm = await screen.findByRole('group', { name: 'Stop the run?' });
    expect(confirm.textContent).toContain(
      'The step in flight is cancelled and marked Skipped. Everything it already wrote is kept.',
    );
    fireEvent.click(within(confirm).getByRole('button', { name: 'Stop run' }));

    await waitFor(() =>
      expect(storeState['stopWorkflowRunNow']).toHaveBeenCalledWith(SESSION_ID, RUN_ID),
    );
  });
  it('pauses a live run from the strip and keeps Stop on offer', () => {
    renderStrip({ agents: [agent(0, 'running')] });

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));

    expect(storeState['pauseWorkflowRun']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
    screen.getByRole('button', { name: 'Stop' });
  });

  it('says it is paused, what finishes, and resumes on Resume', () => {
    renderStrip({
      runOverride: run({ autoRun: true, orchestrationStop: { kind: 'paused', message: 'paused' } }),
      agents: [agent(0, 'running', { name: 'Reviewer' })],
    });

    expect(sentence()).toBe('Paused by you');
    expect(screen.getByTestId('orchestrator-detail').textContent).toContain(
      'Reviewer finishes its turn.',
    );
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));

    expect(storeState['resumeWorkflowRun']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
    expect(storeState['setWorkflowRunAutonomy']).not.toHaveBeenCalled();
  });
  it('says the plan is ready and approves it from the strip', () => {
    renderStrip({
      runOverride: run({
        autoRun: true,
        orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
      }),
      agents: [agent(0, 'completed', { name: 'Planner' })],
    });

    expect(sentence()).toBe('Plan ready · waiting for you');
    fireEvent.click(screen.getByRole('button', { name: 'Approve plan' }));

    expect(storeState['approveWorkflowRunPlan']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
    expect(storeState['orchestrateNextStep']).not.toHaveBeenCalled();
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
          message: 'Paused at the $12.00 spend limit for this run.',
        },
      }),
    });

    expect(sentence()).toBe('Paused at the $12.00 spend limit for this run.');
    expect(screen.queryByTestId('orchestrator-retry')).toBeNull();
    fireEvent.click(screen.getByTestId('run-spend-limit-trigger'));

    expect(screen.getByRole('dialog', { name: 'Spend limit for this run' })).toBeDefined();
  });

  it('reads a budget pause worded differently as a pause all the same', () => {
    renderStrip({
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'any other wording' } }),
    });

    expect(sentence()).toBe('Paused at the spend limit');
    expect(screen.getByTestId('run-spend-limit-trigger').textContent).toContain(
      'Raise the spend limit',
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
  it('reads as one row with Pause, the model and the overflow, and the hint field under it', () => {
    renderStrip({ agents: [agent(0, 'running')], runOverride: run({ autoRun: true }) });

    const row = screen.getByTestId('orchestrator-strip-row');
    expect(row.contains(screen.getByRole('button', { name: 'Pause' }))).toBe(true);
    expect(row.contains(screen.getByTestId('orchestrator-routing'))).toBe(true);
    expect(row.contains(screen.getByRole('button', { name: 'Orchestrator actions' }))).toBe(true);
    expect(row.contains(screen.getByTestId('orchestrator-hint-input'))).toBe(false);
    expect(screen.queryByRole('switch', { name: 'Autorun' })).toBeNull();
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

  it('queues a hint from the field under the strip', () => {
    renderStrip();

    fireEvent.change(screen.getByTestId('orchestrator-hint-input'), {
      target: { value: 'ignore the website' },
    });
    fireEvent.click(screen.getByTestId('orchestrator-hint-queue'));

    expect(storeState['addWorkflowOrchestratorHint']).toHaveBeenCalledWith(SESSION_ID, RUN_ID, {
      text: 'ignore the website',
      delivery: 'queue',
    });
  });

  it('sends a hint to be read now', () => {
    renderStrip();

    fireEvent.change(screen.getByTestId('orchestrator-hint-input'), {
      target: { value: 'look at the payout domain first' },
    });
    fireEvent.click(screen.getByTestId('orchestrator-hint-now'));

    expect(storeState['addWorkflowOrchestratorHint']).toHaveBeenCalledWith(SESSION_ID, RUN_ID, {
      text: 'look at the payout domain first',
      delivery: 'now',
    });
  });

  it('says what read now does in the state the run is in', () => {
    renderStrip();
    expect(screen.getByTestId('orchestrator-hint-timing').textContent).toContain(
      'asks for a decision right away',
    );

    cleanup();
    renderStrip({ agents: [agent(0, 'running')] });
    expect(screen.getByTestId('orchestrator-hint-timing').textContent).toContain(
      'stops the step in flight',
    );

    cleanup();
    renderStrip({ isOrchestrating: true });
    expect(screen.getByTestId('orchestrator-hint-timing').textContent).toContain(
      'Read now restarts this one with your hint.',
    );
  });

  it('keeps hint delivery open while the orchestrator is deciding', () => {
    renderStrip({ isOrchestrating: true });

    const input = screen.getByTestId('orchestrator-hint-input');
    expect(input.hasAttribute('disabled')).toBe(false);
    fireEvent.change(input, { target: { value: 'skip the visual suite' } });
    expect(screen.getByTestId('orchestrator-hint-queue').hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByTestId('orchestrator-hint-now'));

    expect(storeState['addWorkflowOrchestratorHint']).toHaveBeenCalledWith(SESSION_ID, RUN_ID, {
      text: 'skip the visual suite',
      delivery: 'now',
    });
  });

  it('clears the field as soon as a hint is sent, keeping the focus there', () => {
    storeState['addWorkflowOrchestratorHint'] = vi.fn(() => new Promise(() => undefined));
    renderStrip();

    const input = screen.getByTestId('orchestrator-hint-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ignore the website' } });
    fireEvent.click(screen.getByTestId('orchestrator-hint-queue'));

    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
  });

  it('puts the text back when the hint could not be saved', async () => {
    storeState['addWorkflowOrchestratorHint'] = vi.fn(async () => {
      throw new Error('disk full');
    });
    storeState['reportError'] = vi.fn(async () => undefined);
    renderStrip();

    const input = screen.getByTestId('orchestrator-hint-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ignore the website' } });
    fireEvent.click(screen.getByTestId('orchestrator-hint-now'));

    expect(input.value).toBe('');
    await waitFor(() => expect(input.value).toBe('ignore the website'));
    expect(storeState['reportError']).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't save the hint" }),
    );
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
  it('drops Pause and Stop once the run is over', () => {
    renderStrip({
      runOverride: run({ orchestrationOutcome: 'done' }),
      agents: [agent(0, 'completed')],
    });

    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
  });
  it('says a queued hint once, in the log, not again in the state sentence', () => {
    renderStrip({
      runOverride: run({ orchestratorHints: [hint({ id: 'queued-1' }), hint({ id: 'queued-2' })] }),
    });

    expect(sentence()).not.toContain('queued');
    expect(screen.getAllByTestId('orchestrator-hint-row')).toHaveLength(2);
  });

  it('keeps money controls off the card while the run is not paused on budget', () => {
    renderStrip({ agents: [agent(0, 'completed')] });

    expect(screen.queryByTestId('orchestrator-budget')).toBeNull();
    expect(screen.queryByTestId('run-spend-limit-trigger')).toBeNull();
  });

  it('leaves one spend limit control on a budget pause and no budget button', () => {
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

  it('keeps the spend limit out of the state sentence', () => {
    renderStrip({ runOverride: run({ spendLimitUsd: 12, spendLimitMode: 'notify' }) });

    expect(screen.queryByTestId('orchestrator-spend-limit')).toBeNull();
    expect(screen.getByTestId('orchestrator-strip').textContent).not.toContain('Spend limit');
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

  it('saves a spend limit for the run from the budget pause', () => {
    renderStrip({
      runOverride: run({ orchestrationStop: { kind: 'budget', message: 'cap reached' } }),
    });

    fireEvent.click(screen.getByTestId('run-spend-limit-trigger'));
    fireEvent.change(screen.getByTestId('spend-limit-amount'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('tab', { name: /Only warn me/ }));
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
