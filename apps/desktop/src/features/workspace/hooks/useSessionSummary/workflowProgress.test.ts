import { describe, expect, it } from 'vitest';
import type { Agent, AgentStatus, IsoDateTime, Step, Workflow, WorkflowRun } from '@goodboy/types';
import { workflowProgress, type AttachedRun } from './workflowProgress';

const stepOf = ({ id, name, ordinal }: { id: string; name: string; ordinal: number }) =>
  ({ id, name, ordinal }) as unknown as Step;

const STEPS = [
  stepOf({ id: 'scout', name: 'Scout', ordinal: 0 }),
  stepOf({ id: 'plan', name: 'Plan', ordinal: 1 }),
  stepOf({ id: 'implement', name: 'Implement', ordinal: 2 }),
  stepOf({ id: 'test', name: 'Test', ordinal: 3 }),
  stepOf({ id: 'review', name: 'Review', ordinal: 4 }),
];

const workflow = { id: 'wf-1', steps: STEPS } as unknown as Workflow;

const runOf = (patch: Partial<WorkflowRun> = {}): AttachedRun => ({
  run: { id: 'run-1', workflowId: 'wf-1', executionMode: 'sequential', ...patch } as WorkflowRun,
  workflow,
});

const agentOf = ({ stepId, status }: { stepId: string; status: AgentStatus }) =>
  ({ id: `agent-${stepId}`, stepId, workflowRunId: 'run-1', status }) as unknown as Agent;

describe('workflowProgress', () => {
  it('counts the started steps against every live step and names the current one', () => {
    const agents = [
      agentOf({ stepId: 'scout', status: 'completed' }),
      agentOf({ stepId: 'plan', status: 'completed' }),
      agentOf({ stepId: 'implement', status: 'running' }),
      agentOf({ stepId: 'test', status: 'pending' }),
    ];

    expect(workflowProgress({ runs: [runOf()], agents })).toEqual({
      label: 'Implement',
      current: 3,
      total: 5,
    });
  });

  it('never invents a step count for a dynamic run', () => {
    const agents = [agentOf({ stepId: 'scout', status: 'running' })];

    expect(workflowProgress({ runs: [runOf({ executionMode: 'dynamic' })], agents })).toBeNull();
  });

  it('drops a run once every step has settled', () => {
    const agents = STEPS.map((step) =>
      agentOf({ stepId: step.id, status: step.id === 'test' ? 'skipped' : 'completed' }),
    );

    expect(workflowProgress({ runs: [runOf()], agents })).toBeNull();
  });

  it('ignores a discarded run and a run that never started', () => {
    const agents = [agentOf({ stepId: 'scout', status: 'running' })];

    expect(
      workflowProgress({
        runs: [runOf({ discardedAt: '2026-09-01T00:00:00.000Z' as IsoDateTime })],
        agents,
      }),
    ).toBeNull();
    expect(workflowProgress({ runs: [runOf()], agents: [] })).toBeNull();
  });

  it('leaves deleted steps out of the total', () => {
    const trimmed = {
      ...workflow,
      steps: [...STEPS.slice(0, 4), { ...STEPS[4], deletedAt: '2026-09-01T00:00:00.000Z' }],
    } as unknown as Workflow;
    const agents = [agentOf({ stepId: 'scout', status: 'running' })];

    expect(workflowProgress({ runs: [{ ...runOf(), workflow: trimmed }], agents })?.total).toBe(4);
  });
});
