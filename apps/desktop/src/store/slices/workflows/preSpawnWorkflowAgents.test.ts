import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ROLE_DEFAULTS,
  getCheapModel,
  resolveModelArgs,
  resolveModelForProvider,
  resolveStoredModelSelection,
} from '@goodboy/core';
import type { WorkflowRoutingAvailabilitySnapshot } from '@goodboy/core';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderId,
  ModelEffort,
  RoleModelPreferences,
  Session,
  SessionId,
  Step,
  StepId,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

const { invokeAgentInsertSpy } = vi.hoisted(() => ({
  invokeAgentInsertSpy: vi.fn(),
}));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentInsert: invokeAgentInsertSpy,
}));

import { agentReferenceRouting } from '../turn/agentReferenceRouting';
import { preSpawnWorkflowAgents } from './preSpawnWorkflowAgents';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;

const step = (patch: Partial<Step> = {}): Step =>
  ({
    id: 'step-1' as StepId,
    workflowId: 'workflow-1' as WorkflowId,
    ordinal: 0,
    name: 'Implement the fix',
    role: 'implementer',
    promptPrefix: 'Do it.',
    ...patch,
  }) as Step;

beforeEach(() => {
  vi.clearAllMocks();
  invokeAgentInsertSpy.mockImplementation(async (input: Record<string, unknown>) => ({
    id: 'agent-1' as AgentId,
    sessionId: input['sessionId'] as SessionId,
    ordinal: input['ordinal'] as number,
    name: input['name'] as string,
    status: 'pending',
  }));
});

const availability = (
  overrides: Partial<WorkflowRoutingAvailabilitySnapshot> = {},
): WorkflowRoutingAvailabilitySnapshot => ({
  connectedProviders: ['anthropic', 'codex'],
  coolingDownProviders: [],
  budgetBlockedProviders: [],
  isSessionBudgetBlocked: false,
  isRunBudgetBlocked: false,
  nowMs: 0,
  ...overrides,
});

const decidedStep = (): Step =>
  step({
    providerOverride: 'codex',
    modelOverride: 'gpt-5.6-sol',
    effort: 'high',
    routingDecision: {
      version: 1,
      proposal: {
        pick: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
        reason: 'The refactor needs deep reasoning.',
        source: 'agent',
        profile: { taskType: 'implementation', difficulty: 'heavy', basis: 'agent' },
      },
      selected: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
      source: 'agent',
      reason: 'The refactor needs deep reasoning.',
      adjustment: 'none',
      executed: null,
    },
    taskProfile: { taskType: 'implementation', difficulty: 'heavy', basis: 'agent' },
  });

describe('preSpawnWorkflowAgents', () => {
  it('spawns the persisted choice and carries the decision onto the agent row', async () => {
    await preSpawnWorkflowAgents({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      steps: [decidedStep()],
      baseOrdinal: 0,
      defaultProvider: 'anthropic',
      roleModels: { implementer: { providerId: 'anthropic', model: 'sonnet-5', effort: 'medium' } },
      availability: availability(),
    });

    const insert = invokeAgentInsertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(insert['providerOverride']).toBe('codex');
    expect(insert['modelOverride']).toBe('gpt-5.6-sol');
    expect(insert['effort']).toBe('high');
    expect(insert['routingDecision']).toMatchObject({ source: 'agent' });
    expect(insert['taskProfile']).toMatchObject({ taskType: 'implementation' });
  });

  it('never spawns on a provider that started cooling down after planning', async () => {
    await preSpawnWorkflowAgents({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      steps: [decidedStep()],
      baseOrdinal: 0,
      defaultProvider: 'anthropic',
      roleModels: null,
      availability: availability({ coolingDownProviders: ['codex'] }),
    });

    const insert = invokeAgentInsertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(insert['providerOverride']).toBe('anthropic');
    expect(insert['routingDecision']).toMatchObject({ adjustment: 'cooldown' });
  });

  it('never spawns a node whose locked model has gone unavailable', async () => {
    const locked = {
      ...decidedStep(),
      routingLock: {
        version: 1,
        pick: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
        origin: 'user',
      },
    } as Step;

    const result = await preSpawnWorkflowAgents({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      steps: [locked],
      baseOrdinal: 0,
      defaultProvider: 'anthropic',
      roleModels: null,
      availability: availability({ coolingDownProviders: ['codex'] }),
    });

    expect(invokeAgentInsertSpy).not.toHaveBeenCalled();
    expect(result.agents).toHaveLength(0);
    expect(result.blocked).toHaveLength(1);
    expect(result.blocked[0]!.stepId).toBe('step-1');
    expect(result.blocked[0]!.reason).toContain('codex/gpt-5.6-sol');
  });

  it('never spawns a node when no model at all can run it', async () => {
    const result = await preSpawnWorkflowAgents({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      steps: [decidedStep()],
      baseOrdinal: 0,
      defaultProvider: 'anthropic',
      roleModels: null,
      availability: availability({ isSessionBudgetBlocked: true }),
    });

    expect(invokeAgentInsertSpy).not.toHaveBeenCalled();
    expect(result.blocked).toHaveLength(1);
  });

  it('blocks a run role pin instead of quietly moving the node elsewhere', async () => {
    const result = await preSpawnWorkflowAgents({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      steps: [
        step({
          role: 'implementer',
          routingDecision: {
            version: 1,
            proposal: null,
            selected: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
            source: 'run_role_lock',
            reason: 'The run role lock selected codex/gpt-5.6-sol.',
            adjustment: 'none',
            executed: null,
          },
        }),
      ],
      baseOrdinal: 0,
      defaultProvider: 'anthropic',
      roleModels: null,
      runRoleModels: {
        implementer: { providerId: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
      },
      availability: availability({ coolingDownProviders: ['codex'] }),
    });

    expect(invokeAgentInsertSpy).not.toHaveBeenCalled();
    expect(result.blocked[0]!.reason).toContain('run role lock');
  });

  it('omits effort on the agent row when the chosen model has no effort control', async () => {
    await preSpawnWorkflowAgents({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      steps: [
        step({
          routingDecision: {
            version: 1,
            proposal: null,
            selected: { provider: 'anthropic', model: 'sonnet-5', effort: null },
            source: 'agent',
            reason: 'This model has no effort control.',
            adjustment: 'none',
            executed: null,
          },
          effort: 'high',
        }),
      ],
      baseOrdinal: 0,
      defaultProvider: 'anthropic',
      roleModels: null,
    });

    const insert = invokeAgentInsertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(insert['effort']).toBeUndefined();
  });

  it('leaves an explicit lock alone rather than substituting another model', async () => {
    const locked = {
      ...decidedStep(),
      routingLock: {
        version: 1,
        pick: { provider: 'codex', model: 'gpt-5.6-sol', effort: 'high' },
        origin: 'user',
      },
    } as Step;

    await preSpawnWorkflowAgents({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      steps: [locked],
      baseOrdinal: 0,
      defaultProvider: 'anthropic',
      roleModels: null,
      availability: availability(),
    });

    const insert = invokeAgentInsertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(insert['providerOverride']).toBe('codex');
    expect(insert['routingLock']).toMatchObject({ origin: 'user' });
  });

  it('writes the resolved routing on the agent row instead of only in memory', async () => {
    const result = await preSpawnWorkflowAgents({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      steps: [step({ modelOverride: 'opus-5', effort: 'high' })],
      baseOrdinal: 0,
      defaultProvider: 'anthropic',
      roleModels: null,
    });

    const insert = invokeAgentInsertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(insert['providerOverride']).toBe('anthropic');
    expect(insert['modelOverride']).toBe('opus-5');
    expect(insert['effort']).toBe('high');
    expect(result.modelOverrides['agent-1']).toBe(insert['modelOverride']);
    expect(result.providerOverrides['agent-1']).toBe(insert['providerOverride']);
  });

  it('persists the role default when the step pins no model', async () => {
    await preSpawnWorkflowAgents({
      sessionId: SESSION_ID,
      steps: [step()],
      baseOrdinal: 0,
      defaultProvider: 'anthropic',
      roleModels: null,
    });

    const insert = invokeAgentInsertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(insert['modelOverride']).toBeTypeOf('string');
    expect(insert['modelOverride']).not.toBe('');
    expect(insert['providerOverride']).toBe('anthropic');
  });

  it('runs a scout step decided mid-run on the scout role model, never on an expensive one', async () => {
    const result = await preSpawnWorkflowAgents({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      steps: [step({ role: 'scout', name: 'Survey the routing code' })],
      baseOrdinal: 0,
      defaultProvider: 'anthropic',
      roleModels: null,
    });

    const insert = invokeAgentInsertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(insert['modelOverride']).toBe(ROLE_DEFAULTS.scout.model);
    expect(insert['modelOverride']).not.toBe('opus-5');
    expect(insert['effort']).toBe(ROLE_DEFAULTS.scout.effort);
    expect(result.modelOverrides['agent-1']).toBe(ROLE_DEFAULTS.scout.model);
  });

  it('keeps each step on its own role model when a run mixes roles', async () => {
    await preSpawnWorkflowAgents({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      steps: [
        step({ id: 'step-1' as StepId, ordinal: 0, role: 'scout', name: 'Survey' }),
        step({ id: 'step-2' as StepId, ordinal: 1, role: 'planner', name: 'Plan' }),
      ],
      baseOrdinal: 0,
      defaultProvider: 'anthropic',
      roleModels: null,
    });

    const [scoutInsert, plannerInsert] = invokeAgentInsertSpy.mock.calls.map(
      (call) => call[0] as Record<string, unknown>,
    );
    expect(scoutInsert!['modelOverride']).toBe(ROLE_DEFAULTS.scout.model);
    expect(plannerInsert!['modelOverride']).toBe(ROLE_DEFAULTS.planner.model);
    expect(scoutInsert!['modelOverride']).not.toBe(plannerInsert!['modelOverride']);
  });

  it('still honours a per-step model the orchestrator picked for one unusual step', async () => {
    await preSpawnWorkflowAgents({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      steps: [step({ role: 'scout', modelOverride: 'opus-5', effort: 'high' })],
      baseOrdinal: 0,
      defaultProvider: 'anthropic',
      roleModels: null,
    });

    const insert = invokeAgentInsertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(insert['modelOverride']).toBe('opus-5');
    expect(insert['effort']).toBe('high');
  });
});

const NOW = '2026-08-01T00:00:00.000Z' as IsoDateTime;

const makeSession = (defaultProvider: ProviderId): Session => ({
  id: SESSION_ID,
  workspaceId: 'ws-1' as WorkspaceId,
  goal: 'g',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider, allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
});

const makeAgent = (spawnStep: Step): Agent => ({
  id: 'agent-1' as AgentId,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: spawnStep.name,
  status: 'pending',
  kind: 'scout',
  stepId: spawnStep.id,
});

type InvariantParams = {
  readonly spawnStep: Step;
  readonly defaultProvider: ProviderId;
  readonly roleModels: RoleModelPreferences | null;
};

const spawnAndReference = async ({ spawnStep, defaultProvider, roleModels }: InvariantParams) => {
  const spawned = await preSpawnWorkflowAgents({
    sessionId: SESSION_ID,
    workflowRunId: RUN_ID,
    steps: [spawnStep],
    baseOrdinal: 0,
    defaultProvider,
    roleModels,
  });
  const persisted = {
    provider: spawned.providerOverrides['agent-1'],
    model: spawned.modelOverrides['agent-1'],
    effort: spawned.effortOverrides['agent-1'],
  };
  const reference = agentReferenceRouting({
    agent: makeAgent(spawnStep),
    stepConfig: spawnStep,
    roleModels,
    session: makeSession(defaultProvider),
  });
  return { persisted, reference };
};

describe('preSpawnWorkflowAgents and agentReferenceRouting agree', () => {
  it('lets the role preference win over a non-default session provider on both sides', async () => {
    const roleModels: RoleModelPreferences = {
      scout: { providerId: 'anthropic', model: 'sonnet-5', effort: 'high' },
    };
    const { persisted, reference } = await spawnAndReference({
      spawnStep: step({ role: 'scout', name: 'Survey' }),
      defaultProvider: 'codex',
      roleModels,
    });

    expect(persisted).toEqual({ provider: 'anthropic', model: 'sonnet-5', effort: 'high' });
    expect(reference).toEqual(persisted);
  });

  it('lets the session default win over the hardcoded fallback on both sides', async () => {
    const { persisted, reference } = await spawnAndReference({
      spawnStep: step({ role: 'scout', name: 'Survey' }),
      defaultProvider: 'codex',
      roleModels: null,
    });

    expect(persisted).toEqual({
      provider: 'codex',
      model: resolveModelForProvider({ provider: 'codex', modelId: getCheapModel('codex') }),
      effort: 'low',
    });
    expect(reference).toEqual(persisted);
  });

  it('lets the step pin win over everything on both sides', async () => {
    const { persisted, reference } = await spawnAndReference({
      spawnStep: step({
        role: 'scout',
        name: 'Survey',
        providerOverride: 'anthropic',
        modelOverride: 'opus-5',
        effort: 'high',
      }),
      defaultProvider: 'codex',
      roleModels: {
        scout: { providerId: 'cursor', model: 'gpt-5.6-sol', effort: 'medium' },
      },
    });

    expect(persisted).toEqual({ provider: 'anthropic', model: 'opus-5', effort: 'high' });
    expect(reference).toEqual(persisted);
  });
});

const executionOf = ({
  provider,
  model,
  effort,
}: {
  readonly provider: ProviderId;
  readonly model: string;
  readonly effort: ModelEffort | undefined;
}): ReadonlyArray<string> =>
  resolveModelArgs({
    provider,
    selection: resolveStoredModelSelection({
      provider,
      id: model,
      ...(effort != null && { effort }),
    }).selection,
  }).args;

describe('preSpawnWorkflowAgents keeps the combo a step pinned', () => {
  it('persists the cursor fast combo and runs it', async () => {
    const { persisted, reference } = await spawnAndReference({
      spawnStep: step({
        role: 'implementer',
        providerOverride: 'cursor',
        modelOverride: 'composer-2.5-fast',
      }),
      defaultProvider: 'cursor',
      roleModels: null,
    });

    expect(persisted.model).toBe('composer-2.5-fast');
    expect(reference).toEqual(persisted);
    expect(
      executionOf({
        provider: 'cursor',
        model: persisted.model ?? '',
        effort: persisted.effort,
      }),
    ).toContain('composer-2.5-fast');
  });

  it('persists the cursor thinking combo and runs it', async () => {
    const { persisted, reference } = await spawnAndReference({
      spawnStep: step({
        role: 'implementer',
        providerOverride: 'cursor',
        modelOverride: 'claude-4.6-sonnet-medium-thinking',
      }),
      defaultProvider: 'cursor',
      roleModels: null,
    });

    expect(persisted.model).toBe('claude-4.6-sonnet-medium-thinking');
    expect(reference).toEqual(persisted);
    expect(
      executionOf({
        provider: 'cursor',
        model: persisted.model ?? '',
        effort: persisted.effort,
      }),
    ).toContain('claude-4.6-sonnet-medium-thinking');
  });

  it('leaves a base pin alone on both sides', async () => {
    const { persisted, reference } = await spawnAndReference({
      spawnStep: step({
        role: 'implementer',
        providerOverride: 'cursor',
        modelOverride: 'composer-2.5',
      }),
      defaultProvider: 'cursor',
      roleModels: null,
    });

    expect(persisted.model).toBe('composer-2.5');
    expect(reference).toEqual(persisted);
    expect(
      executionOf({
        provider: 'cursor',
        model: persisted.model ?? '',
        effort: persisted.effort,
      }),
    ).toContain('composer-2.5');
  });
});
