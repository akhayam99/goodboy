import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLE_DEFAULTS } from '@goodboy/core';
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
