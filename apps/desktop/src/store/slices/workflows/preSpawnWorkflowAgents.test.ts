import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, SessionId, Step, StepId, WorkflowId, WorkflowRunId } from '@goodboy/types';

const { invokeAgentInsertSpy } = vi.hoisted(() => ({
  invokeAgentInsertSpy: vi.fn(),
}));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentInsert: invokeAgentInsertSpy,
}));

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

  it('gives a run policy precedence over the decided step routing', async () => {
    const result = await preSpawnWorkflowAgents({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      steps: [
        step({
          providerOverride: 'anthropic',
          modelOverride: 'opus-5',
          effort: 'max',
        }),
      ],
      baseOrdinal: 0,
      defaultProvider: 'anthropic',
      roleModels: null,
      routingOverride: { providerId: 'codex', model: 'gpt-5.5', effort: 'high' },
    });

    const insert = invokeAgentInsertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(insert).toMatchObject({
      providerOverride: 'codex',
      modelOverride: 'gpt-5.5',
      effort: 'high',
    });
    expect(result.effortOverrides['agent-1']).toBe('high');
  });

  it('does not carry a decided effort into a policy model with no effort', async () => {
    const result = await preSpawnWorkflowAgents({
      sessionId: SESSION_ID,
      workflowRunId: RUN_ID,
      steps: [step({ modelOverride: 'opus-5', effort: 'max' })],
      baseOrdinal: 0,
      defaultProvider: 'anthropic',
      roleModels: null,
      routingOverride: { providerId: 'anthropic', model: 'haiku-4.5' },
    });

    const insert = invokeAgentInsertSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(insert['modelOverride']).toBe('haiku-4.5');
    expect(insert['effort']).toBeUndefined();
    expect(result.effortOverrides['agent-1']).toBeUndefined();
  });
});
