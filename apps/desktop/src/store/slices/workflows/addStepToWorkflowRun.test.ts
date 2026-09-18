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
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }));

const {
  invokeWorkflowUpsertSpy,
  invokeAgentInsertSpy,
  repointWorkflowRunTemplateSpy,
  listOpenQuestionsSpy,
  updateOrchestrationStopSpy,
} = vi.hoisted(() => ({
  invokeWorkflowUpsertSpy: vi.fn(),
  invokeAgentInsertSpy: vi.fn(),
  repointWorkflowRunTemplateSpy: vi.fn(async () => undefined),
  listOpenQuestionsSpy: vi.fn(async () => []),
  updateOrchestrationStopSpy: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({
  repointWorkflowRunTemplate: repointWorkflowRunTemplateSpy,
  listOpenQuestionsForSession: listOpenQuestionsSpy,
  updateWorkflowRunOrchestrationStop: updateOrchestrationStopSpy,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeWorkflowUpsert: invokeWorkflowUpsertSpy,
  invokeAgentInsert: invokeAgentInsertSpy,
}));

import { addStepToWorkflowRun } from './addStepToWorkflowRun';
import { maybeAutoAdvanceWorkflow } from './maybeAutoAdvanceWorkflow';

const WORKSPACE_ID = 'ws-1' as WorkspaceId;
const SESSION_ID = 'ses-1' as SessionId;
const WORKFLOW_ID = 'wf-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const NOW = '2026-09-18T00:00:00.000Z' as IsoDateTime;

type WorkflowParams = {
  readonly isPreset: boolean;
};

const makeWorkflow = ({ isPreset }: WorkflowParams): Workflow => ({
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Ship it',
  description: 'the usual chain',
  steps: [
    {
      id: 'step-1' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      name: 'Scout',
      role: 'scout',
      promptPrefix: 'Inspect the code.',
    },
    {
      id: 'step-2' as StepId,
      workflowId: WORKFLOW_ID,
      ordinal: 1,
      name: 'Implement',
      role: 'implementer',
      promptPrefix: 'Write the change.',
    },
  ],
  isPreset,
  origin: isPreset ? 'library' : 'custom',
  createdAt: NOW,
  updatedAt: NOW,
});

type AgentParams = {
  readonly stepId: string;
  readonly status: AgentStatus;
  readonly ordinal: number;
};

const makeAgent = ({ stepId, status, ordinal }: AgentParams): Agent => ({
  id: `agent-${stepId}` as AgentId,
  sessionId: SESSION_ID,
  stepId: stepId as StepId,
  workflowRunId: RUN_ID,
  ordinal,
  name: stepId,
  status,
});

type SessionParams = {
  readonly autoRun?: boolean;
  readonly discardedAt?: IsoDateTime;
};

const makeSession = ({ autoRun = false, discardedAt }: SessionParams = {}): Session => ({
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'ship the change',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [
    {
      id: RUN_ID,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      currentStep: 0,
      autoRun,
      triggerMode: 'immediate',
      executionMode: 'static',
      ...(discardedAt != null && { discardedAt }),
    },
  ],
  autoRun,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
});

type State = Record<string, unknown>;

type StateParams = {
  readonly isPreset?: boolean;
  readonly agents?: ReadonlyArray<Agent>;
  readonly autoRun?: boolean;
  readonly discardedAt?: IsoDateTime;
};

const baseState = ({
  isPreset = false,
  agents,
  autoRun = false,
  discardedAt,
}: StateParams = {}): State => {
  const workflow = makeWorkflow({ isPreset });
  return {
    sessions: [makeSession({ autoRun, ...(discardedAt != null && { discardedAt }) })],
    workspaces: [{ id: WORKSPACE_ID, rootPath: '/tmp/repo', kind: 'repo' }],
    providers: [{ id: 'anthropic', connection: 'connected' }],
    providerCooldowns: {},
    budgetAlerts: [],
    announcedWorkflowBlocks: {},
    announcedRunBudget: {},
    sessionTelemetry: {},
    summarizerStatus: {},
    agentRunHistory: {},
    phaseTemplates: { [WORKSPACE_ID]: [workflow] },
    sessionWorkflows: { [SESSION_ID]: [workflow] },
    sessionPhaseRuns: {
      [SESSION_ID]: agents ?? [
        makeAgent({ stepId: 'step-1', status: 'completed', ordinal: 0 }),
        makeAgent({ stepId: 'step-2', status: 'completed', ordinal: 1 }),
      ],
    },
    workspaceOverrides: {},
    transcripts: {},
    agentTurnState: {},
    agentModelOverride: {},
    agentKindOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
    loadSessionTelemetry: vi.fn(async () => undefined),
    startWorkflowRun: vi.fn(async () => undefined),
    activateWorkflowAgent: vi.fn(async () => undefined),
    orchestrateNextStep: vi.fn(async () => undefined),
    emitNotification: vi.fn(async () => undefined),
    maybeAutoAdvanceWorkflow: vi.fn(async () => undefined),
  };
};

const harness = (state: State) => {
  const set = vi.fn((updater: unknown) => {
    if (typeof updater === 'function') {
      Object.assign(state, (updater as (current: State) => State)(state));
      return;
    }
    Object.assign(state, updater as State);
  });
  const get = () => state;
  return {
    set: set as never,
    get: get as never,
    add: addStepToWorkflowRun(set as never, get as never),
  };
};

const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const upsertArgs = () =>
  invokeWorkflowUpsertSpy.mock.calls[0]![0] as {
    readonly id: WorkflowId;
    readonly isPreset: boolean;
    readonly origin?: string;
    readonly steps: ReadonlyArray<Record<string, unknown>>;
  };

beforeEach(() => {
  vi.clearAllMocks();
  listOpenQuestionsSpy.mockResolvedValue([]);
  invokeWorkflowUpsertSpy.mockImplementation(
    async (args: {
      readonly id: WorkflowId;
      readonly workspaceId: WorkspaceId;
      readonly name: string;
      readonly description: string;
      readonly isPreset: boolean;
      readonly steps: ReadonlyArray<Record<string, unknown>>;
    }) => ({
      id: args.id,
      workspaceId: args.workspaceId,
      name: args.name,
      description: args.description,
      isPreset: args.isPreset,
      createdAt: NOW,
      updatedAt: NOW,
      steps: args.steps.map((step) => ({ ...step, workflowId: args.id })),
    }),
  );
  invokeAgentInsertSpy.mockImplementation(
    async (args: {
      readonly sessionId: SessionId;
      readonly stepId: StepId;
      readonly workflowRunId: WorkflowRunId;
      readonly ordinal: number;
      readonly name: string;
    }) => ({
      id: 'agent-new' as AgentId,
      sessionId: args.sessionId,
      stepId: args.stepId,
      workflowRunId: args.workflowRunId,
      ordinal: args.ordinal,
      name: args.name,
      status: 'pending' as AgentStatus,
    }),
  );
});

describe('addStepToWorkflowRun', () => {
  it('appends the step in place when the run template is not a preset', async () => {
    const state = baseState({
      agents: [
        makeAgent({ stepId: 'step-1', status: 'completed', ordinal: 0 }),
        makeAgent({ stepId: 'step-2', status: 'running', ordinal: 1 }),
      ],
    });
    const { add } = harness(state);

    const result = await add({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      name: 'Review',
      role: 'reviewer',
      promptPrefix: 'Check the change.',
    });

    expect(result.kind).toBe('added');
    expect(repointWorkflowRunTemplateSpy).not.toHaveBeenCalled();
    const args = upsertArgs();
    expect(args.id).toBe(WORKFLOW_ID);
    expect(args.steps).toHaveLength(3);
    expect(args.steps[0]!['id']).toBe('step-1');
    expect(args.steps[2]!['ordinal']).toBe(2);
    expect(args.steps[2]!['name']).toBe('Review');
    const insert = invokeAgentInsertSpy.mock.calls[0]![0];
    expect(insert.ordinal).toBe(2);
    expect(insert.stepId).toBe(args.steps[2]!['id']);
    const agents = (state['sessionPhaseRuns'] as Record<string, ReadonlyArray<Agent>>)[SESSION_ID]!;
    expect(agents).toHaveLength(3);
    expect(agents[2]!.status).toBe('pending');
  });

  it('clones a preset template and keeps the existing agents resolvable', async () => {
    const state = baseState({
      isPreset: true,
      agents: [
        makeAgent({ stepId: 'step-1', status: 'completed', ordinal: 0 }),
        makeAgent({ stepId: 'step-2', status: 'running', ordinal: 1 }),
      ],
    });
    const { add } = harness(state);

    const result = await add({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      name: 'Review',
      role: 'reviewer',
    });

    expect(result.kind).toBe('added');
    const args = upsertArgs();
    expect(args.id).not.toBe(WORKFLOW_ID);
    expect(args.isPreset).toBe(false);
    expect(args.origin).toBe('custom');
    expect(args.steps.map((step) => step['id'])).not.toContain('step-1');
    expect(repointWorkflowRunTemplateSpy).toHaveBeenCalledTimes(1);

    const sessions = state['sessions'] as ReadonlyArray<Session>;
    const run = sessions[0]!.workflowRuns[0]!;
    expect(run.workflowId).toBe(args.id);

    const templates = (state['phaseTemplates'] as Record<string, ReadonlyArray<Workflow>>)[
      WORKSPACE_ID
    ]!;
    const clone = templates.find((workflow) => workflow.id === run.workflowId)!;
    const agents = (state['sessionPhaseRuns'] as Record<string, ReadonlyArray<Agent>>)[SESSION_ID]!;
    for (const agent of agents) {
      expect(clone.steps.some((step) => step.id === agent.stepId)).toBe(true);
    }
    expect(templates.some((workflow) => workflow.id === WORKFLOW_ID)).toBe(true);
  });

  it('hands the new step to autorun without extra wiring', async () => {
    const state = baseState({
      autoRun: true,
      agents: [
        makeAgent({ stepId: 'step-1', status: 'completed', ordinal: 0 }),
        makeAgent({ stepId: 'step-2', status: 'running', ordinal: 1 }),
      ],
    });
    const { set, get, add } = harness(state);
    const advance = maybeAutoAdvanceWorkflow(set, get);
    state['maybeAutoAdvanceWorkflow'] = advance;

    const result = await add({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      name: 'Review',
      role: 'reviewer',
    });

    expect(result.kind).toBe('added');
    await flush();
    expect(state['activateWorkflowAgent']).not.toHaveBeenCalled();

    const phaseRuns = state['sessionPhaseRuns'] as Record<string, ReadonlyArray<Agent>>;
    state['sessionPhaseRuns'] = {
      ...phaseRuns,
      [SESSION_ID]: (phaseRuns[SESSION_ID] ?? []).map((agent) =>
        agent.stepId === ('step-2' as StepId)
          ? { ...agent, status: 'completed' as AgentStatus }
          : agent,
      ),
    };
    await advance(SESSION_ID);

    await vi.waitFor(() =>
      expect(state['activateWorkflowAgent']).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: SESSION_ID, agentId: 'agent-new' }),
      ),
    );
  });

  it('refuses a discarded run', async () => {
    const state = baseState({ discardedAt: NOW });
    const { add } = harness(state);

    const result = await add({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      name: 'Review',
      role: 'reviewer',
    });

    expect(result).toEqual({ kind: 'refused', reason: 'this run was discarded' });
    expect(invokeWorkflowUpsertSpy).not.toHaveBeenCalled();
  });

  it('refuses a run whose steps have all settled', async () => {
    const state = baseState();
    const { add } = harness(state);

    const result = await add({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      name: 'Review',
      role: 'reviewer',
    });

    expect(result).toEqual({ kind: 'refused', reason: 'this run is already finished' });
    expect(invokeWorkflowUpsertSpy).not.toHaveBeenCalled();
  });
});
