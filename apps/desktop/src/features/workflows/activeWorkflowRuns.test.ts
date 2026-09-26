import { describe, expect, it } from 'vitest';
import type { Agent, AgentId, WorkflowRun, WorkflowRunId } from '@goodboy/types';
import { hasActiveWorkflowRun } from './activeWorkflowRuns';

const RUN_1 = 'run-1' as WorkflowRunId;

const run = (overrides: Partial<WorkflowRun> = {}): WorkflowRun =>
  ({
    id: RUN_1,
    workflowId: 'workflow-1',
    ordinal: 0,
    currentStep: 0,
    autoRun: false,
    triggerMode: 'manual',
    executionMode: 'sequential',
    ...overrides,
  }) as WorkflowRun;

const agent = (overrides: Partial<Agent> = {}): Agent =>
  ({
    id: 'agent-1' as AgentId,
    workflowRunId: RUN_1,
    status: 'running',
    ...overrides,
  }) as Agent;

describe('hasActiveWorkflowRun', () => {
  it('is false with no workflow runs at all', () => {
    expect(hasActiveWorkflowRun({ workflowRuns: [], agents: [] })).toBe(false);
  });

  it('ignores a discarded run even if its agents still run', () => {
    expect(
      hasActiveWorkflowRun({
        workflowRuns: [run({ discardedAt: '2026-06-08T10:00:00.000Z' as never })],
        agents: [agent({ status: 'running' })],
      }),
    ).toBe(false);
  });

  it('is active while any of its agents has not concluded', () => {
    expect(
      hasActiveWorkflowRun({
        workflowRuns: [run()],
        agents: [agent({ status: 'pending' })],
      }),
    ).toBe(true);
  });

  it('is not active once every one of its agents has concluded', () => {
    expect(
      hasActiveWorkflowRun({
        workflowRuns: [run()],
        agents: [agent({ status: 'completed' }), agent({ status: 'failed' })],
      }),
    ).toBe(false);
  });

  it('treats a run with no agents yet as still active', () => {
    expect(hasActiveWorkflowRun({ workflowRuns: [run()], agents: [] })).toBe(true);
  });

  it('does not let an old, fully concluded run keep a session "in workflow" forever', () => {
    expect(
      hasActiveWorkflowRun({
        workflowRuns: [run({ id: 'run-old' as WorkflowRunId })],
        agents: [agent({ workflowRunId: 'run-old' as WorkflowRunId, status: 'skipped' })],
      }),
    ).toBe(false);
  });
});
