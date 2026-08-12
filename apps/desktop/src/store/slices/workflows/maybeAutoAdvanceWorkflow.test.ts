import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  AgentStatus,
  IsoDateTime,
  Session,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

const { listOpenQuestionsSpy, updateOrchestrationStopSpy } = vi.hoisted(() => ({
  listOpenQuestionsSpy: vi.fn(async () => []),
  updateOrchestrationStopSpy: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({
  listOpenQuestionsForSession: listOpenQuestionsSpy,
  updateWorkflowRunOrchestrationStop: updateOrchestrationStopSpy,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { maybeAutoAdvanceWorkflow } from './maybeAutoAdvanceWorkflow';

const WS_ID = 'ws-1' as WorkspaceId;
const WF_ID = 'wf-1' as WorkflowId;
const SESSION_ID = 'ses-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-07-27T00:00:00.000Z' as IsoDateTime;

const makeWorkflow = (stepIds: ReadonlyArray<string>): Workflow => ({
  id: WF_ID,
  workspaceId: WS_ID,
  name: 'wf',
  description: '',
  steps: stepIds.map((stepId, i) => ({
    id: stepId as StepId,
    workflowId: WF_ID,
    ordinal: i,
    name: stepId,
    promptPrefix: '',
  })),
  createdAt: NOW,
  updatedAt: NOW,
});

const makeAgent = (stepId: string, status: AgentStatus, ordinal: number): Agent => ({
  id: `${RUN_ID}-${stepId}` as AgentId,
  sessionId: SESSION_ID,
  stepId: stepId as StepId,
  workflowRunId: RUN_ID,
  ordinal,
  name: stepId,
  status,
});

const makeSession = (): Session => ({
  id: SESSION_ID,
  workspaceId: WS_ID,
  goal: 'g',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: {
    defaultProvider: 'anthropic',
    allowTurnOverride: true,
  } as Session['providerPreference'],
  permissionMode: 'default' as Session['permissionMode'],
  workflowRuns: [
    {
      id: RUN_ID,
      workflowId: WF_ID,
      ordinal: 0,
      currentStep: 0,
      autoRun: true,
      triggerMode: 'immediate',
      executionMode: 'static',
    },
  ],
  autoRun: true,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
});

type StoreState = Record<string, unknown>;

const baseState = (stepIds: ReadonlyArray<string>, agents: ReadonlyArray<Agent>): StoreState => ({
  sessions: [makeSession()],
  phaseTemplates: { [WS_ID]: [makeWorkflow(stepIds)] },
  sessionPhaseRuns: { [SESSION_ID]: agents },
  summarizerStatus: {},
  budgetAlerts: [],
  announcedWorkflowBlocks: {},
  startWorkflowRun: vi.fn(async () => undefined),
  activateWorkflowAgent: vi.fn(async () => undefined),
  orchestrateNextStep: vi.fn(async () => undefined),
  emitNotification: vi.fn(async () => undefined),
});

const harness = (state: StoreState) => {
  const set = vi.fn((updater: unknown) => {
    if (typeof updater === 'function') {
      Object.assign(state, (updater as (s: StoreState) => StoreState)(state));
      return;
    }
    Object.assign(state, updater as StoreState);
  });
  return { set: set as never, get: (() => state) as never };
};

beforeEach(() => {
  vi.clearAllMocks();
  listOpenQuestionsSpy.mockResolvedValue([]);
});

describe('maybeAutoAdvanceWorkflow', () => {
  it('activates the next pending step once its predecessors are done', async () => {
    const state = baseState(
      ['s0', 's1', 's2'],
      [
        makeAgent('s0', 'completed', 0),
        makeAgent('s1', 'pending', 1),
        makeAgent('s2', 'pending', 2),
      ],
    );
    const { set, get } = harness(state);
    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);
    expect(state['activateWorkflowAgent']).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: `${RUN_ID}-s1`,
      focus: 'announce',
    });
  });

  it('advances the lowest-ordinal run when two are eligible at once', async () => {
    const SECOND_ID = 'run-2' as WorkflowRunId;
    const agentFor = (runId: WorkflowRunId): Agent => ({
      id: `${runId}-s0` as AgentId,
      sessionId: SESSION_ID,
      stepId: 's0' as StepId,
      workflowRunId: runId,
      ordinal: 0,
      name: 's0',
      status: 'pending',
    });
    const session = makeSession();
    const state = baseState(['s0'], [agentFor(RUN_ID), agentFor(SECOND_ID)]);
    state['sessions'] = [
      {
        ...session,
        workflowRuns: [
          { ...session.workflowRuns[0]!, id: SECOND_ID, ordinal: 1 },
          session.workflowRuns[0]!,
        ],
      },
    ];
    const { set, get } = harness(state);

    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);

    expect(state['activateWorkflowAgent']).toHaveBeenCalledTimes(1);
    expect(state['activateWorkflowAgent']).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: `${RUN_ID}-s0`,
      focus: 'announce',
    });
  });

  it('orchestrates the highest-ordinal dynamic run when two are eligible at once', async () => {
    const SECOND_ID = 'run-2' as WorkflowRunId;
    const session = makeSession();
    const dynamicRun = (id: WorkflowRunId, ordinal: number): WorkflowRun => ({
      ...session.workflowRuns[0]!,
      id,
      ordinal,
      executionMode: 'dynamic',
    });
    const state = baseState([], []);
    state['sessions'] = [
      { ...session, workflowRuns: [dynamicRun(SECOND_ID, 1), dynamicRun(RUN_ID, 0)] },
    ];
    const { set, get } = harness(state);

    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);

    expect(state['orchestrateNextStep']).toHaveBeenCalledTimes(1);
    expect(state['orchestrateNextStep']).toHaveBeenCalledWith(SESSION_ID, SECOND_ID);
  });

  it('does not skip past a step that failed', async () => {
    const state = baseState(
      ['s0', 's1'],
      [makeAgent('s0', 'failed', 0), makeAgent('s1', 'pending', 1)],
    );
    const { set, get } = harness(state);
    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);
    expect(state['activateWorkflowAgent']).not.toHaveBeenCalled();
    expect(state['emitNotification']).toHaveBeenCalledWith(
      'error',
      'warning',
      'workflow blocked',
      'Autorun stopped at s0 because the step failed.',
      { sessionId: SESSION_ID },
    );
  });

  it('announces a stop once, not on every later pass', async () => {
    const state = baseState(
      ['s0', 's1'],
      [makeAgent('s0', 'failed', 0), makeAgent('s1', 'pending', 1)],
    );
    const { set, get } = harness(state);
    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);
    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);
    expect(state['emitNotification']).toHaveBeenCalledTimes(1);
  });

  it('announces again when the failed step is retried and fails again', async () => {
    const state = baseState(
      ['s0', 's1'],
      [makeAgent('s0', 'failed', 0), makeAgent('s1', 'pending', 1)],
    );
    const { set, get } = harness(state);
    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);
    state['sessionPhaseRuns'] = {
      [SESSION_ID]: [
        { ...makeAgent('s0', 'failed', 0), id: 'retry-s0' as AgentId },
        makeAgent('s1', 'pending', 1),
      ],
    };
    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);
    expect(state['emitNotification']).toHaveBeenCalledTimes(2);
  });

  it('stays quiet when autorun simply has nothing left to advance', async () => {
    const state = baseState(['s0'], [makeAgent('s0', 'completed', 0)]);
    const { set, get } = harness(state);
    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);
    expect(state['activateWorkflowAgent']).not.toHaveBeenCalled();
    expect(state['emitNotification']).not.toHaveBeenCalled();
  });

  it('spawns a single agent when two advances race', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const state = baseState(['s0'], [makeAgent('s0', 'pending', 0)]);
    state['activateWorkflowAgent'] = vi.fn(async () => {
      await gate;
    });
    const { set, get } = harness(state);
    const advance = maybeAutoAdvanceWorkflow(set, get);
    const first = advance(SESSION_ID);
    const second = advance(SESSION_ID);
    release();
    await Promise.all([first, second]);
    expect(state['activateWorkflowAgent']).toHaveBeenCalledTimes(1);
  });

  it('starts a chained run and activates its first step in the same pass', async () => {
    const CHAINED_ID = 'run-2' as WorkflowRunId;
    const predAgent = makeAgent('s0', 'completed', 0);
    const chainedAgent: Agent = {
      id: `${CHAINED_ID}-s0` as AgentId,
      sessionId: SESSION_ID,
      stepId: 's0' as StepId,
      workflowRunId: CHAINED_ID,
      ordinal: 0,
      name: 'chained step',
      status: 'pending',
    };
    const session = makeSession();
    const state = baseState(['s0'], [predAgent, chainedAgent]);
    state['sessions'] = [
      {
        ...session,
        workflowRuns: [
          ...session.workflowRuns,
          {
            id: CHAINED_ID,
            workflowId: WF_ID,
            ordinal: 1,
            currentStep: 0,
            autoRun: true,
            triggerMode: 'after_run',
            chainAfterId: RUN_ID,
          },
        ],
      },
    ];
    state['startWorkflowRun'] = vi.fn(async () => {
      const [current] = state['sessions'] as ReadonlyArray<Session>;
      state['sessions'] = [
        {
          ...(current as Session),
          workflowRuns: (current as Session).workflowRuns.map((r) =>
            r.id === CHAINED_ID ? { ...r, triggerMode: 'immediate' as const } : r,
          ),
        },
      ];
    });
    const { set, get } = harness(state);

    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);

    expect(state['startWorkflowRun']).toHaveBeenCalledWith(SESSION_ID, CHAINED_ID);
    expect(state['activateWorkflowAgent']).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: `${CHAINED_ID}-s0`,
      focus: 'announce',
    });
  });

  it('holds while the summarizer runs and advances once it finishes', async () => {
    const state = baseState(['s0'], [makeAgent('s0', 'pending', 0)]);
    state['summarizerStatus'] = { [SESSION_ID]: { status: 'running' } };
    const { set, get } = harness(state);
    const advance = maybeAutoAdvanceWorkflow(set, get);

    await advance(SESSION_ID);
    expect(state['activateWorkflowAgent']).not.toHaveBeenCalled();

    state['summarizerStatus'] = { [SESSION_ID]: { status: 'idle' } };
    await advance(SESSION_ID);
    expect(state['activateWorkflowAgent']).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: `${RUN_ID}-s0`,
      focus: 'announce',
    });
  });

  it('orchestrates a dynamic run when no pending agent exists', async () => {
    const state = baseState([], []);
    const session = (state['sessions'] as ReadonlyArray<Session>)[0]!;
    state['sessions'] = [
      {
        ...session,
        workflowRuns: session.workflowRuns.map((run) => ({
          ...run,
          executionMode: 'dynamic' as const,
        })),
      },
    ];
    const { set, get } = harness(state);

    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);

    expect(state['orchestrateNextStep']).toHaveBeenCalledWith(SESSION_ID, RUN_ID);
  });

  it('does not orchestrate a dynamic run with a persisted terminal outcome', async () => {
    const state = baseState([], []);
    const session = (state['sessions'] as ReadonlyArray<Session>)[0]!;
    state['sessions'] = [
      {
        ...session,
        workflowRuns: session.workflowRuns.map((run) => ({
          ...run,
          executionMode: 'dynamic' as const,
          orchestrationOutcome: 'done' as const,
        })),
      },
    ];
    const { set, get } = harness(state);

    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);

    expect(state['orchestrateNextStep']).not.toHaveBeenCalled();
  });

  it('starts a chained run only after the dynamic predecessor persists done', async () => {
    const CHAINED_ID = 'run-2' as WorkflowRunId;
    const chained: WorkflowRun = {
      id: CHAINED_ID,
      workflowId: WF_ID,
      ordinal: 1,
      currentStep: 0,
      autoRun: true,
      triggerMode: 'after_run',
      executionMode: 'static',
      chainAfterId: RUN_ID,
    };
    const session = makeSession();
    const dynamicPredecessor = (outcome?: 'done' | 'blocked'): WorkflowRun => ({
      ...session.workflowRuns[0]!,
      executionMode: 'dynamic',
      ...(outcome != null && { orchestrationOutcome: outcome }),
    });
    const state = baseState([], []);
    state['sessions'] = [{ ...session, workflowRuns: [dynamicPredecessor(), chained] }];
    const { set, get } = harness(state);
    const advance = maybeAutoAdvanceWorkflow(set, get);

    await advance(SESSION_ID);
    expect(state['startWorkflowRun']).not.toHaveBeenCalled();

    state['sessions'] = [{ ...session, workflowRuns: [dynamicPredecessor('done'), chained] }];
    await advance(SESSION_ID);
    expect(state['startWorkflowRun']).toHaveBeenCalledWith(SESSION_ID, CHAINED_ID);
  });

  it('does not orchestrate while a dynamic step is still running', async () => {
    const state = baseState(['s0'], [makeAgent('s0', 'running', 0)]);
    const session = (state['sessions'] as ReadonlyArray<Session>)[0]!;
    state['sessions'] = [
      {
        ...session,
        workflowRuns: session.workflowRuns.map((run) => ({
          ...run,
          executionMode: 'dynamic' as const,
        })),
      },
    ];
    const { set, get } = harness(state);

    await maybeAutoAdvanceWorkflow(set, get)(SESSION_ID);

    expect(state['orchestrateNextStep']).not.toHaveBeenCalled();
  });

  it('records the budget stop once while the cap stays reached', async () => {
    const state = baseState(['s0'], [makeAgent('s0', 'pending', 0)]);
    state['budgetAlerts'] = [{ kind: 'provider-exceeded' }];
    const { set, get } = harness(state);
    const advance = maybeAutoAdvanceWorkflow(set, get);

    await advance(SESSION_ID);
    await advance(SESSION_ID);

    expect(updateOrchestrationStopSpy).toHaveBeenCalledTimes(1);
    const run = (state['sessions'] as ReadonlyArray<Session>)[0]!.workflowRuns[0]!;
    expect(run.orchestrationStop).toEqual({
      kind: 'budget',
      message: 'the budget cap is reached, raise it in Budget to keep this run going',
    });
  });

  it('keeps dynamic orchestration behind summarizer, question, and budget gates', async () => {
    const state = baseState([], []);
    const session = (state['sessions'] as ReadonlyArray<Session>)[0]!;
    state['sessions'] = [
      {
        ...session,
        workflowRuns: session.workflowRuns.map((run) => ({
          ...run,
          executionMode: 'dynamic' as const,
        })),
      },
    ];
    const { set, get } = harness(state);
    const advance = maybeAutoAdvanceWorkflow(set, get);

    state['summarizerStatus'] = { [SESSION_ID]: { status: 'running' } };
    await advance(SESSION_ID);
    state['summarizerStatus'] = {};
    state['budgetAlerts'] = [{ kind: 'provider-exceeded' }];
    await advance(SESSION_ID);
    expect(updateOrchestrationStopSpy).toHaveBeenCalledWith({}, RUN_ID, {
      kind: 'budget',
      message: 'the budget cap is reached, raise it in Budget to keep this run going',
    });
    state['budgetAlerts'] = [];
    listOpenQuestionsSpy.mockResolvedValue([
      {
        id: 'question-1',
        sessionId: SESSION_ID,
        workflowRunId: RUN_ID,
        text: 'Which path?',
        suggestedAnswers: [],
        userAnswer: null,
        status: 'open',
        createdAt: NOW,
      },
    ] as never);
    await advance(SESSION_ID);

    expect(state['orchestrateNextStep']).not.toHaveBeenCalled();
  });
});
