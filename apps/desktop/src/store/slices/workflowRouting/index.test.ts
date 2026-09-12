import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Session,
  SessionId,
  Step,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRoutingDecision,
  WorkflowRoutingLock,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

const { invokeWorkflowNodeRoutingUpdateSpy } = vi.hoisted(() => ({
  invokeWorkflowNodeRoutingUpdateSpy: vi.fn(),
}));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeWorkflowNodeRoutingUpdate: invokeWorkflowNodeRoutingUpdateSpy,
}));

import {
  isWorkflowRoutingDecision,
  isWorkflowRoutingLock,
  parseRoutingJson,
  stringifyRoutingJson,
} from '@goodboy/db';
import { childRoutingBatch } from '../workflows/childRoutingBatch';
import { resolveWorkflowChildRouting } from './resolveWorkflowChildRouting';
import { resetWorkflowNodeRoutingLock } from './resetWorkflowNodeRoutingLock';
import { selectWorkflowNodeRouting } from './selectWorkflowNodeRouting';
import { setWorkflowNodeRoutingLock } from './setWorkflowNodeRoutingLock';
import { workflowNodeRoutingKey } from './workflowNodeRoutingKey';
import type { GetFn, SetFn } from './types';

const SESSION_ID = 'session-1' as SessionId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const RUN_ID = 'run-1' as WorkflowRunId;
const AGENT_ID = 'agent-1' as AgentId;
const STEP_ID = 'step-1' as StepId;
const NOW = '2026-09-11T00:00:00.000Z' as IsoDateTime;
const AGENT_KEY = workflowNodeRoutingKey({ nodeKind: 'agent', id: AGENT_ID });
const STEP_KEY = workflowNodeRoutingKey({ nodeKind: 'step', id: STEP_ID });

const proposalDecision: WorkflowRoutingDecision = {
  version: 1,
  proposal: {
    pick: { provider: 'anthropic', model: 'sonnet-5', effort: 'medium' },
    reason: 'A standard implementation step fits a mid tier model.',
    source: 'agent',
    profile: { taskType: 'implementation', difficulty: 'standard', basis: 'agent' },
  },
  selected: { provider: 'anthropic', model: 'opus-5', effort: 'high' },
  source: 'run_role_lock',
  reason: 'The run role lock selected anthropic/opus-5.',
  adjustment: 'none',
  executed: null,
};

const heuristicDecision: WorkflowRoutingDecision = {
  version: 1,
  proposal: null,
  selected: { provider: 'codex', model: 'gpt-5.6-luna', effort: 'medium' },
  source: 'heuristic',
  reason: 'Deterministic selection for implementation work at standard difficulty.',
  adjustment: 'cooldown',
  executed: null,
};

const legacyLock: WorkflowRoutingLock = {
  version: 1,
  pick: { provider: 'anthropic', model: 'sonnet-5', effort: 'medium' },
  origin: 'legacy',
};

type StepParams = {
  readonly routingLock?: WorkflowRoutingLock | null;
  readonly routingDecision?: WorkflowRoutingDecision | null;
};

const buildStep = ({ routingLock = null, routingDecision = null }: StepParams = {}): Step => ({
  id: STEP_ID,
  workflowId: WORKFLOW_ID,
  ordinal: 0,
  name: 'Implement the change',
  promptPrefix: 'implement',
  role: 'implementer',
  routingLock,
  routingDecision,
  taskProfile: null,
});

const buildWorkflow = (step: Step): Workflow => ({
  id: WORKFLOW_ID,
  workspaceId: WORKSPACE_ID,
  name: 'Delivery',
  description: '',
  steps: [step],
  createdAt: NOW,
  updatedAt: NOW,
});

type AgentParams = {
  readonly status?: Agent['status'];
  readonly routingLock?: WorkflowRoutingLock | null;
  readonly routingDecision?: WorkflowRoutingDecision | null;
};

const buildAgent = ({
  status = 'pending',
  routingLock = null,
  routingDecision = null,
}: AgentParams = {}): Agent => ({
  id: AGENT_ID,
  sessionId: SESSION_ID,
  stepId: STEP_ID,
  workflowRunId: RUN_ID,
  ordinal: 0,
  name: 'Implement the change',
  status,
  kind: 'implementer',
  providerOverride: 'anthropic',
  modelOverride: 'opus-5',
  effort: 'high',
  routingLock,
  routingDecision,
  taskProfile: null,
});

type SessionParams = {
  readonly hasRunRoleLock?: boolean;
};

const buildSession = ({ hasRunRoleLock = true }: SessionParams = {}): Session => ({
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
      autoRun: false,
      triggerMode: 'immediate',
      executionMode: 'dynamic',
      ...(hasRunRoleLock && {
        roleModelOverrides: {
          implementer: { providerId: 'anthropic', model: 'opus-5', effort: 'high' },
        },
      }),
    },
  ],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
});

type HarnessParams = {
  readonly agent?: Agent;
  readonly step?: Step;
  readonly hasRunRoleLock?: boolean;
};

const buildHarness = ({
  agent = buildAgent(),
  step = buildStep(),
  hasRunRoleLock = true,
}: HarnessParams = {}) => {
  const state: Record<string, unknown> = {
    sessions: [buildSession({ hasRunRoleLock })],
    sessionPhaseRuns: { [SESSION_ID]: [agent] },
    sessionWorkflows: { [SESSION_ID]: [buildWorkflow(step)] },
    agentKindOverride: {},
    agentModelOverride: {},
    agentProviderOverride: {},
    agentEffortOverride: {},
    workspaceOverrides: {},
    providers: [
      { id: 'anthropic', connection: 'connected' },
      { id: 'codex', connection: 'connected' },
    ],
    providerCooldowns: {},
    budgetAlerts: [],
    workflowNodeRoutingPending: {},
    workflowNodeRoutingErrors: {},
  };
  const set = ((patch: unknown) => {
    const next = typeof patch === 'function' ? (patch as (s: unknown) => object)(state) : patch;
    Object.assign(state, next);
  }) as SetFn;
  const get = (() => state) as unknown as GetFn;
  return { state, set, get };
};

const persistedArgs = () =>
  invokeWorkflowNodeRoutingUpdateSpy.mock.calls[0]?.[0] as {
    readonly routingLock: WorkflowRoutingLock | null;
    readonly routingDecision: WorkflowRoutingDecision;
    readonly nodeKind: string;
    readonly providerOverride: string | null;
    readonly modelOverride: string | null;
  };

describe('workflowRouting slice', () => {
  beforeEach(() => {
    invokeWorkflowNodeRoutingUpdateSpy.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('a user lock reloads through the routing codec and still beats the run role lock', async () => {
    const { state, set, get } = buildHarness({
      agent: buildAgent({ routingDecision: proposalDecision }),
    });

    const unlocked = resolveWorkflowChildRouting({
      state: get(),
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      role: 'implementer',
      childLock: null,
      proposal: null,
      promptText: 'implement the change',
      missingProposal: 'configured_default',
    }).resolution;
    expect(unlocked.kind).toBe('ready');
    if (unlocked.kind !== 'ready') {
      return;
    }
    expect(unlocked.decision.source).toBe('run_role_lock');
    expect(unlocked.decision.selected).toEqual({
      provider: 'anthropic',
      model: 'opus-5',
      effort: 'high',
    });

    await setWorkflowNodeRoutingLock(
      set,
      get,
    )({
      sessionId: SESSION_ID,
      nodeKind: 'agent',
      id: AGENT_ID,
      pick: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
    });

    const persisted = persistedArgs();
    expect(persisted.nodeKind).toBe('agent');
    expect(persisted.routingLock?.origin).toBe('user');
    expect(persisted.routingDecision.source).toBe('step_lock');
    expect(persisted.routingDecision.selected.model).toBe('gpt-5.6-sol');
    expect(persisted.providerOverride).toBe('codex');

    const storedLock = stringifyRoutingJson({
      value: persisted.routingLock,
      isValid: isWorkflowRoutingLock,
      field: 'routing lock',
    });
    const storedDecision = stringifyRoutingJson({
      value: persisted.routingDecision,
      isValid: isWorkflowRoutingDecision,
      field: 'routing decision',
    });
    const loadedLock = parseRoutingJson({
      value: storedLock,
      isValid: isWorkflowRoutingLock,
      field: 'routing lock',
    });
    const loadedDecision = parseRoutingJson({
      value: storedDecision,
      isValid: isWorkflowRoutingDecision,
      field: 'routing decision',
    });
    expect(loadedLock).toEqual(persisted.routingLock);
    expect(loadedDecision).toEqual(persisted.routingDecision);

    const reloaded = {
      ...buildAgent(),
      routingLock: loadedLock,
      routingDecision: loadedDecision,
    };
    const view = selectWorkflowNodeRouting({
      agent: reloaded,
      step: buildStep(),
      isPending: false,
      error: null,
    });
    expect(view.isLocked).toBe(true);
    expect(view.selected).toEqual({ provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' });
    expect(view.sourceLabel).toBe('Locked by you');
    expect(state.workflowNodeRoutingErrors).toEqual({ [AGENT_KEY]: null });

    const relocked = resolveWorkflowChildRouting({
      state: get(),
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      role: 'implementer',
      childLock: loadedLock,
      proposal: null,
      promptText: 'implement the change',
      missingProposal: 'configured_default',
    }).resolution;
    expect(relocked.kind).toBe('ready');
    if (relocked.kind !== 'ready') {
      return;
    }
    expect(relocked.decision.source).toBe('step_lock');
    expect(relocked.decision.selected).toEqual({
      provider: 'codex',
      model: 'gpt-5.6-sol',
      effort: 'high',
    });
  });

  it('does not label a deterministic recovery a choice made on fit', () => {
    const view = selectWorkflowNodeRouting({
      agent: buildAgent({ routingDecision: heuristicDecision }),
      step: buildStep(),
      isPending: false,
      error: null,
    });

    expect(view.sourceLabel).toBe('Chosen from what is available');
  });

  it('reset restores proposal without editing the template', async () => {
    const lockedAgent = buildAgent({
      routingDecision: proposalDecision,
      routingLock: {
        version: 1,
        pick: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
        origin: 'user',
      },
    });
    const templateStep = buildStep({ routingDecision: proposalDecision });
    const { state, set, get } = buildHarness({
      agent: lockedAgent,
      step: templateStep,
      hasRunRoleLock: false,
    });

    await resetWorkflowNodeRoutingLock(
      set,
      get,
    )({
      sessionId: SESSION_ID,
      nodeKind: 'agent',
      id: AGENT_ID,
    });

    const persisted = persistedArgs();
    expect(persisted.routingLock).toBeNull();
    expect(persisted.routingDecision.selected).toEqual({
      provider: 'anthropic',
      model: 'sonnet-5',
      effort: 'medium',
    });
    expect(persisted.routingDecision.source).toBe('agent');
    expect(persisted.routingDecision.proposal?.reason).toBe(
      'A standard implementation step fits a mid tier model.',
    );
    const workflows = state.sessionWorkflows as Record<string, ReadonlyArray<Workflow>>;
    expect(workflows[SESSION_ID]?.[0]?.steps[0]).toEqual(templateStep);
  });

  it('reset reveals the run role lock instead of implying free routing', async () => {
    const lockedAgent = buildAgent({
      routingDecision: proposalDecision,
      routingLock: {
        version: 1,
        pick: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
        origin: 'user',
      },
    });
    const { set, get } = buildHarness({ agent: lockedAgent });

    await resetWorkflowNodeRoutingLock(
      set,
      get,
    )({
      sessionId: SESSION_ID,
      nodeKind: 'agent',
      id: AGENT_ID,
    });

    const persisted = persistedArgs();
    expect(persisted.routingLock).toBeNull();
    expect(persisted.routingDecision.source).toBe('run_role_lock');
    expect(persisted.routingDecision.selected.model).toBe('opus-5');
  });

  it('running node refuses routing edits', async () => {
    const { state, set, get } = buildHarness({ agent: buildAgent({ status: 'running' }) });

    await setWorkflowNodeRoutingLock(
      set,
      get,
    )({
      sessionId: SESSION_ID,
      nodeKind: 'agent',
      id: AGENT_ID,
      pick: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
    });

    expect(invokeWorkflowNodeRoutingUpdateSpy).not.toHaveBeenCalled();
    const errors = state.workflowNodeRoutingErrors as Record<string, string | null>;
    expect(errors[AGENT_KEY]).toContain('already started');
  });

  it('surfaces the persistence refusal instead of failing silently', async () => {
    invokeWorkflowNodeRoutingUpdateSpy.mockRejectedValue({
      kind: 'node_not_mutable',
      message: 'workflow node cannot be changed: agent-1',
    });
    const { state, set, get } = buildHarness();

    await setWorkflowNodeRoutingLock(
      set,
      get,
    )({
      sessionId: SESSION_ID,
      nodeKind: 'agent',
      id: AGENT_ID,
      pick: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
    });

    const errors = state.workflowNodeRoutingErrors as Record<string, string | null>;
    const pending = state.workflowNodeRoutingPending as Record<string, boolean>;
    expect(errors[AGENT_KEY]).toContain('already started');
    expect(pending[AGENT_KEY]).toBe(false);
  });

  it('legacy reset does not resurrect the legacy pin', async () => {
    const { state, set, get } = buildHarness({ step: buildStep({ routingLock: legacyLock }) });

    const view = selectWorkflowNodeRouting({
      agent: buildAgent(),
      step: buildStep({ routingLock: legacyLock }),
      isPending: false,
      error: null,
    });
    expect(view.isLegacy).toBe(true);
    expect(view.sourceLabel).toBe('Existing selection');

    await resetWorkflowNodeRoutingLock(
      set,
      get,
    )({
      sessionId: SESSION_ID,
      nodeKind: 'step',
      id: STEP_ID,
    });

    const persisted = persistedArgs();
    expect(persisted.nodeKind).toBe('step');
    expect(persisted.routingLock).toBeNull();
    expect(persisted.routingDecision).not.toBeNull();
    const workflows = state.sessionWorkflows as Record<string, ReadonlyArray<Workflow>>;
    const reloadedStep = workflows[SESSION_ID]?.[0]?.steps[0];
    expect(reloadedStep?.routingLock).toBeNull();
    expect(reloadedStep?.routingDecision).not.toBeNull();
    const errors = state.workflowNodeRoutingErrors as Record<string, string | null>;
    expect(errors[STEP_KEY]).toBeNull();
  });
});

describe('fan-out child routing precedence', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const childRequest = {
    proposal: null,
    promptText: 'map the session guards',
    childLock: null,
  };

  it('run role lock survives fan-out with absent parent resolved fields', () => {
    const parent = buildAgent();
    const { get } = buildHarness({
      agent: {
        ...parent,
        providerOverride: undefined,
        modelOverride: undefined,
        effort: undefined,
      },
    });

    const { resolution } = resolveWorkflowChildRouting({
      state: get(),
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      role: 'implementer',
      childLock: null,
      proposal: null,
      promptText: 'apply the change',
      missingProposal: 'deterministic_pick',
    });

    expect(resolution.kind).toBe('ready');
    if (resolution.kind !== 'ready') {
      return;
    }
    expect(resolution.decision.source).toBe('run_role_lock');
    expect(resolution.decision.selected.model).toBe('opus-5');
  });

  it('parent node lock does not lock descendants', () => {
    const { get } = buildHarness({
      hasRunRoleLock: false,
      agent: buildAgent({
        routingLock: {
          version: 1,
          pick: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
          origin: 'user',
        },
      }),
    });

    const { resolution } = resolveWorkflowChildRouting({
      state: get(),
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      role: 'implementer',
      childLock: null,
      proposal: null,
      promptText: 'apply the change',
      missingProposal: 'deterministic_pick',
    });

    expect(resolution.kind).toBe('ready');
    if (resolution.kind !== 'ready') {
      return;
    }
    expect(resolution.decision.selected.model).not.toBe('gpt-5.6-sol');
    expect(resolution.decision.source).toBe('heuristic');
  });

  it('explicit child lock beats its run role lock', () => {
    const { get } = buildHarness();

    const { resolution } = resolveWorkflowChildRouting({
      state: get(),
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      role: 'implementer',
      childLock: {
        version: 1,
        pick: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
        origin: 'user',
      },
      proposal: null,
      promptText: 'apply the change',
      missingProposal: 'deterministic_pick',
    });

    expect(resolution.kind).toBe('ready');
    if (resolution.kind !== 'ready') {
      return;
    }
    expect(resolution.decision.source).toBe('step_lock');
    expect(resolution.decision.selected.model).toBe('gpt-5.6-sol');
  });

  it('budget block prevents partial child materialization', () => {
    vi.stubEnv('VITE_WORKFLOW_CHILD_MODEL_SELECTION', 'true');
    const { state, get } = buildHarness();
    state.budgetAlerts = [
      {
        id: 'alert-1',
        kind: 'session-exceeded',
        sessionId: SESSION_ID,
        currentUsd: 12,
        capUsd: 10,
        createdAt: NOW,
      },
    ];

    const batch = childRoutingBatch({
      state: get(),
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      role: 'implementer',
      requests: [childRequest, { ...childRequest, promptText: 'list the settings strings' }],
    });

    expect(batch.kind).toBe('blocked');
  });
  it('gives a legacy child with no proposal a pick read off its own text', () => {
    const { get } = buildHarness({ hasRunRoleLock: false });

    const { resolution, taskProfile } = resolveWorkflowChildRouting({
      state: get(),
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      role: 'implementer',
      childLock: null,
      proposal: null,
      promptText: 'redesign the workflow routing store and migrate database rows across the app',
      missingProposal: 'deterministic_pick',
    });

    expect(resolution.kind).toBe('ready');
    if (resolution.kind !== 'ready') {
      return;
    }
    expect(resolution.decision.source).toBe('heuristic');
    expect(resolution.decision.reason).toContain('heuristic estimate');
    expect(taskProfile?.difficulty).toBe('heavy');
    expect(taskProfile?.basis).toBe('heuristic');
  });

  it('keeps a root manual node with no proposal on its configured default', async () => {
    const { get, set } = buildHarness({ hasRunRoleLock: false });

    await resetWorkflowNodeRoutingLock(
      set,
      get,
    )({ sessionId: SESSION_ID, nodeKind: 'step', id: STEP_ID });

    const persisted = persistedArgs();
    expect(persisted.routingDecision.source).toBe('kind_default');
    expect(persisted.routingDecision.selected).toEqual({
      provider: 'anthropic',
      model: 'sonnet-5',
      effort: 'medium',
    });
  });
});
