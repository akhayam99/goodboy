import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  AgentStatus,
  IsoDateTime,
  Session,
  SessionId,
  StepId,
  RoleModelPreferences,
  Workflow,
  WorkflowOrchestrationOutcome,
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
  updateOrchestrationOutcomeSpy,
} = vi.hoisted(() => ({
  invokeWorkflowUpsertSpy: vi.fn(),
  invokeAgentInsertSpy: vi.fn(),
  repointWorkflowRunTemplateSpy: vi.fn(async () => undefined),
  listOpenQuestionsSpy: vi.fn(async () => []),
  updateOrchestrationStopSpy: vi.fn(async () => undefined),
  updateOrchestrationOutcomeSpy: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({
  repointWorkflowRunTemplate: repointWorkflowRunTemplateSpy,
  listOpenQuestionsForSession: listOpenQuestionsSpy,
  updateWorkflowRunOrchestrationStop: updateOrchestrationStopSpy,
  updateWorkflowRunOrchestrationOutcome: updateOrchestrationOutcomeSpy,
}));

vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentGenerationReserve: async ({ count }: { readonly count: number }) => ({
    kind: 'granted' as const,
    reservations: Array.from({ length: count }, (_, index) => ({
      reservationId: `reservation:${index}`,
      depth: 1,
      causalRootAgentId: null,
    })),
  }),
  invokeAgentGenerationBind: async () => undefined,
  invokeEvidenceInventoryRecord: async () => undefined,
  invokeEvidenceDeliveryRecord: async () => undefined,
  invokeWorkflowUpsert: invokeWorkflowUpsertSpy,
  invokeAgentInsert: invokeAgentInsertSpy,
}));

const { preSpawnSpy } = vi.hoisted(() => ({ preSpawnSpy: vi.fn() }));

vi.mock('./preSpawnWorkflowAgents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./preSpawnWorkflowAgents')>();
  preSpawnSpy.mockImplementation(actual.preSpawnWorkflowAgents);
  return { preSpawnWorkflowAgents: preSpawnSpy };
});

import { addStepToWorkflowRun } from './addStepToWorkflowRun';
import { maybeAutoAdvanceWorkflow } from './maybeAutoAdvanceWorkflow';
import { isWorkflowRunComplete } from '../../../features/workflows/isWorkflowRunComplete';

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
  readonly siblingRuns?: ReadonlyArray<Session['workflowRuns'][number]>;
  readonly dynamicOutcome?: WorkflowOrchestrationOutcome;
  readonly roleModelOverrides?: RoleModelPreferences;
};

const makeSession = ({
  autoRun = false,
  discardedAt,
  siblingRuns = [],
  dynamicOutcome,
  roleModelOverrides,
}: SessionParams = {}): Session => ({
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
      executionMode: dynamicOutcome == null ? 'static' : 'dynamic',
      ...(dynamicOutcome != null && {
        orchestrationOutcome: dynamicOutcome,
        orchestrationReason: 'the orchestrator said so',
      }),
      ...(discardedAt != null && { discardedAt }),
      ...(roleModelOverrides != null && { roleModelOverrides }),
    },
    ...siblingRuns,
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
  readonly siblingRuns?: ReadonlyArray<Session['workflowRuns'][number]>;
  readonly dynamicOutcome?: WorkflowOrchestrationOutcome;
  readonly roleModelOverrides?: RoleModelPreferences;
  readonly workspaceRoleModels?: RoleModelPreferences;
};

const baseState = ({
  isPreset = false,
  agents,
  autoRun = false,
  discardedAt,
  siblingRuns,
  dynamicOutcome,
  roleModelOverrides,
  workspaceRoleModels,
}: StateParams = {}): State => {
  const workflow = makeWorkflow({ isPreset });
  return {
    sessions: [
      makeSession({
        autoRun,
        ...(discardedAt != null && { discardedAt }),
        ...(siblingRuns != null && { siblingRuns }),
        ...(dynamicOutcome != null && { dynamicOutcome }),
        ...(roleModelOverrides != null && { roleModelOverrides }),
      }),
    ],
    workspaces: [{ id: WORKSPACE_ID, rootPath: '/tmp/repo', kind: 'repo' }],
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'connected' },
    ],
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
    workspaceOverrides:
      workspaceRoleModels == null ? {} : { [WORKSPACE_ID]: { roleModels: workspaceRoleModels } },
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

type UpsertArgs = {
  readonly id: WorkflowId;
  readonly isPreset: boolean;
  readonly name: string;
  readonly origin?: string;
  readonly steps: ReadonlyArray<Record<string, unknown>>;
};

const upsertArgs = () => invokeWorkflowUpsertSpy.mock.calls[0]![0] as UpsertArgs;

const upsertArgsAt = (index: number) => invokeWorkflowUpsertSpy.mock.calls[index]![0] as UpsertArgs;

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
    expect(args.name).toBe('Ship it');
    expect(args.origin).toBe('library');
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

    const attached = (state['sessionWorkflows'] as Record<string, ReadonlyArray<Workflow>>)[
      SESSION_ID
    ]!;
    expect(attached.map((workflow) => workflow.id)).toEqual([run.workflowId]);
  });

  it('keeps the preset name on the clone when the backend only guards preset names', async () => {
    const livePresetNames = new Set(['Ship it']);
    invokeWorkflowUpsertSpy.mockImplementation(
      async (args: {
        readonly id: WorkflowId;
        readonly workspaceId: WorkspaceId;
        readonly name: string;
        readonly description: string;
        readonly isPreset: boolean;
        readonly steps: ReadonlyArray<Record<string, unknown>>;
      }) => {
        let name = args.name;
        if (args.isPreset === true) {
          let suffix = 2;
          while (livePresetNames.has(name)) {
            name = `${args.name} ${suffix}`;
            suffix += 1;
          }
          livePresetNames.add(name);
        }
        return {
          id: args.id,
          workspaceId: args.workspaceId,
          name,
          description: args.description,
          isPreset: args.isPreset,
          createdAt: NOW,
          updatedAt: NOW,
          steps: args.steps.map((step) => ({ ...step, workflowId: args.id })),
        };
      },
    );
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
    const sessions = state['sessions'] as ReadonlyArray<Session>;
    const run = sessions[0]!.workflowRuns[0]!;
    const templates = (state['phaseTemplates'] as Record<string, ReadonlyArray<Workflow>>)[
      WORKSPACE_ID
    ]!;
    const clone = templates.find((workflow) => workflow.id === run.workflowId)!;
    expect(clone.name).toBe('Ship it');
    expect(templates.find((workflow) => workflow.id === WORKFLOW_ID)!.name).toBe('Ship it');
    const attached = (state['sessionWorkflows'] as Record<string, ReadonlyArray<Workflow>>)[
      SESSION_ID
    ]!;
    expect(attached.map((workflow) => workflow.name)).toEqual(['Ship it']);
  });

  it('keeps the preset attached when another run still points at it', async () => {
    const state = baseState({
      isPreset: true,
      agents: [
        makeAgent({ stepId: 'step-1', status: 'completed', ordinal: 0 }),
        makeAgent({ stepId: 'step-2', status: 'running', ordinal: 1 }),
      ],
      siblingRuns: [
        {
          id: 'run-2' as WorkflowRunId,
          workflowId: WORKFLOW_ID,
          ordinal: 1,
          currentStep: 0,
          autoRun: false,
          triggerMode: 'immediate',
          executionMode: 'static',
        },
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
    const attached = (state['sessionWorkflows'] as Record<string, ReadonlyArray<Workflow>>)[
      SESSION_ID
    ]!;
    expect(attached.map((workflow) => workflow.id)).toContain(WORKFLOW_ID);
    expect(attached).toHaveLength(2);
  });

  it('rolls the step back when no agent can be spawned', async () => {
    const state = baseState({
      agents: [
        makeAgent({ stepId: 'step-1', status: 'completed', ordinal: 0 }),
        makeAgent({ stepId: 'step-2', status: 'running', ordinal: 1 }),
      ],
    });
    preSpawnSpy.mockResolvedValueOnce({
      agents: [],
      modelOverrides: {},
      kindOverrides: {},
      providerOverrides: {},
      effortOverrides: {},
      blocked: [{ stepId: 'step-new' as StepId, stepName: 'Review', reason: 'anthropic is down' }],
    });
    const { add } = harness(state);

    const result = await add({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      name: 'Review',
      role: 'reviewer',
    });

    expect(result).toEqual({ kind: 'refused', reason: 'anthropic is down' });
    expect(invokeWorkflowUpsertSpy).toHaveBeenCalledTimes(2);
    const rolledBack = upsertArgsAt(1);
    expect(rolledBack.id).toBe(WORKFLOW_ID);
    expect(rolledBack.steps.map((step) => step['id'])).toEqual(['step-1', 'step-2']);
    const templates = (state['phaseTemplates'] as Record<string, ReadonlyArray<Workflow>>)[
      WORKSPACE_ID
    ]!;
    expect(templates.find((workflow) => workflow.id === WORKFLOW_ID)!.steps).toHaveLength(2);
    const agents = (state['sessionPhaseRuns'] as Record<string, ReadonlyArray<Agent>>)[SESSION_ID]!;
    expect(agents).toHaveLength(2);
  });

  it('refuses while the orchestrator is deciding', async () => {
    const state = baseState({
      agents: [
        makeAgent({ stepId: 'step-1', status: 'completed', ordinal: 0 }),
        makeAgent({ stepId: 'step-2', status: 'running', ordinal: 1 }),
      ],
    });
    state['orchestratingWorkflowRuns'] = { [RUN_ID]: true };
    const { add } = harness(state);

    const result = await add({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      name: 'Review',
      role: 'reviewer',
    });

    expect(result).toEqual({
      kind: 'refused',
      reason: 'the orchestrator is choosing the next step',
    });
    expect(invokeWorkflowUpsertSpy).not.toHaveBeenCalled();
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

  it('appends to a settled static run and the run reads as in progress', async () => {
    const state = baseState();
    const { add } = harness(state);

    const result = await add({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      name: 'Review',
      role: 'reviewer',
    });

    expect(result.kind).toBe('added');
    const sessions = state['sessions'] as ReadonlyArray<Session>;
    const run = sessions[0]!.workflowRuns[0]!;
    const templates = (state['phaseTemplates'] as Record<string, ReadonlyArray<Workflow>>)[
      WORKSPACE_ID
    ]!;
    const workflow = templates.find((candidate) => candidate.id === run.workflowId)!;
    const agents = (state['sessionPhaseRuns'] as Record<string, ReadonlyArray<Agent>>)[SESSION_ID]!;
    expect(workflow.steps).toHaveLength(3);
    expect(isWorkflowRunComplete({ run, workflow, agents, holds: [] })).toBe(false);
  });

  it('clears the outcome of a dynamic run that concluded done and does not call orchestrateNextStep', async () => {
    const state = baseState({ dynamicOutcome: 'done' });
    const { add } = harness(state);

    const result = await add({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      name: 'Review',
      role: 'reviewer',
    });

    expect(result.kind).toBe('added');
    expect(updateOrchestrationOutcomeSpy).toHaveBeenCalledWith({}, RUN_ID, null);
    expect(updateOrchestrationStopSpy).toHaveBeenCalledWith({}, RUN_ID, null);
    const sessions = state['sessions'] as ReadonlyArray<Session>;
    const run = sessions[0]!.workflowRuns[0]!;
    expect(run.orchestrationOutcome).toBeUndefined();
    expect(run.orchestrationReason).toBeUndefined();
    expect(state['orchestrateNextStep']).not.toHaveBeenCalled();
  });

  it('takes a step on a dynamic run the orchestrator stopped as blocked', async () => {
    const state = baseState({ dynamicOutcome: 'blocked' });
    const { add } = harness(state);

    const result = await add({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      name: 'Review',
      role: 'reviewer',
    });

    expect(result.kind).toBe('added');
    const sessions = state['sessions'] as ReadonlyArray<Session>;
    expect(sessions[0]!.workflowRuns[0]!.orchestrationOutcome).toBeUndefined();
  });

  it('routes the new agent through the run role override, not the workspace one', async () => {
    const state = baseState({
      workspaceRoleModels: {
        reviewer: { providerId: 'anthropic', model: 'claude-sonnet-4-5', effort: 'medium' },
      },
      roleModelOverrides: {
        reviewer: { providerId: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
      },
    });
    const { add } = harness(state);

    const result = await add({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      name: 'Review',
      role: 'reviewer',
    });

    expect(result.kind).toBe('added');
    expect(invokeAgentInsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOverride: 'codex',
        modelOverride: 'gpt-5.6-sol',
        effort: 'high',
      }),
    );
  });

  it('puts the new agent in state before it clears the outcome', async () => {
    const state = baseState({ dynamicOutcome: 'done' });
    const seenAgentIds: Array<ReadonlyArray<string>> = [];
    updateOrchestrationOutcomeSpy.mockImplementation(async () => {
      const agents = (state['sessionPhaseRuns'] as Record<string, ReadonlyArray<Agent>>)[
        SESSION_ID
      ]!;
      seenAgentIds.push(agents.map((agent) => agent.id));
      return undefined;
    });
    const { add } = harness(state);

    const result = await add({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      name: 'Review',
      role: 'reviewer',
    });

    expect(result.kind).toBe('added');
    expect(seenAgentIds).toEqual([['agent-step-1', 'agent-step-2', 'agent-new']]);
  });
});
