// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Agent, StepId, Workflow, WorkflowId } from '@goodboy/types';
import { aWorkflowRun, anAgent } from '@goodboy/types/testing';
import { runRowFactsOf } from './runRowFactsOf';

const WORKFLOW_ID: WorkflowId = JSON.parse('"workflow-ledger-export"');

type WorkflowParams = {
  readonly stepCount: number;
};

const workflowOf = ({ stepCount }: WorkflowParams): Workflow => ({
  id: WORKFLOW_ID,
  workspaceId: JSON.parse('"workspace-harborline"'),
  name: 'Fix flaky tests',
  description: '',
  steps: Array.from({ length: stepCount }, (_, index) => ({
    id: JSON.parse(`"step-${index}"`),
    workflowId: WORKFLOW_ID,
    ordinal: index,
    name: `Step ${index + 1}`,
    promptPrefix: '',
  })),
  createdAt: JSON.parse('"2026-10-16T09:00:00.000Z"'),
  updatedAt: JSON.parse('"2026-10-16T09:00:00.000Z"'),
});

type AgentsParams = {
  readonly statuses: ReadonlyArray<Agent['status']>;
};

const agentsOf = ({ statuses }: AgentsParams): ReadonlyArray<Agent> =>
  statuses.map((status, index) => {
    const stepId: StepId = JSON.parse(`"step-${index}"`);
    return anAgent({ id: JSON.parse(`"agent-${index}"`), stepId, status, ordinal: index });
  });

type FactsParams = {
  readonly stepCount: number;
  readonly statuses: ReadonlyArray<Agent['status']>;
};

const progressOf = ({ stepCount, statuses }: FactsParams): string =>
  runRowFactsOf({
    run: aWorkflowRun({ workflowId: WORKFLOW_ID }),
    workflow: workflowOf({ stepCount }),
    agents: agentsOf({ statuses }),
    predecessorName: 'previous',
    isOrchestrating: false,
    questions: [],
  }).progress;

describe('runRowFactsOf progress', () => {
  it('says which step runs while the run lives', () => {
    expect(progressOf({ stepCount: 3, statuses: ['completed', 'running', 'pending'] })).toBe(
      'Step 2 of 3',
    );
  });

  it.each([
    [1, ['completed'], '1 step'],
    [3, ['completed', 'completed', 'completed'], '3 steps'],
  ] as const)('counts the %i steps of a finished run once', (stepCount, statuses, word) => {
    expect(progressOf({ stepCount, statuses })).toBe(word);
  });
});
