import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLE_DEFAULTS } from '@goodboy/core';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  ProviderId,
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

describe('preSpawnWorkflowAgents', () => {
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

    expect(persisted.provider).toBe('anthropic');
    expect(reference).toEqual(persisted);
  });

  it('lets the session default win over the hardcoded fallback on both sides', async () => {
    const { persisted, reference } = await spawnAndReference({
      spawnStep: step({ role: 'scout', name: 'Survey' }),
      defaultProvider: 'codex',
      roleModels: null,
    });

    expect(persisted.provider).toBe('codex');
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
        scout: { providerId: 'cursor', model: 'gpt-5.6', effort: 'medium' },
      },
    });

    expect(persisted).toEqual({ provider: 'anthropic', model: 'opus-5', effort: 'high' });
    expect(reference).toEqual(persisted);
  });
});
