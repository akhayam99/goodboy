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

type WaitParams = {
  readonly run: Parameters<typeof runRowFactsOf>[0]['run'];
  readonly statuses?: ReadonlyArray<Agent['status']>;
  readonly isOrchestrating?: boolean;
};

const waitOf = ({ run, statuses = [], isOrchestrating = false }: WaitParams) =>
  runRowFactsOf({
    run,
    workflow: workflowOf({ stepCount: 3 }),
    agents: agentsOf({ statuses }),
    predecessorName: 'previous',
    isOrchestrating,
    questions: [],
  });

describe('runRowFactsOf wait', () => {
  it('names a run that stopped on a failure while nothing runs', () => {
    const facts = waitOf({
      run: aWorkflowRun({
        workflowId: WORKFLOW_ID,
        orchestrationStop: { kind: 'failure', message: 'The orchestrator failed.' },
      }),
    });

    expect(facts).toMatchObject({ word: 'Failed', wait: 'stopped' });
  });

  it('names a run that paused at its limit', () => {
    const facts = waitOf({
      run: aWorkflowRun({
        workflowId: WORKFLOW_ID,
        orchestrationStop: { kind: 'budget', message: 'Limit reached.' },
      }),
    });

    expect(facts).toMatchObject({ word: 'Paused at the limit', wait: 'limit' });
  });

  it('names a run that waits for the person to continue', () => {
    const facts = waitOf({
      run: aWorkflowRun({ workflowId: WORKFLOW_ID }),
      statuses: ['completed', 'pending', 'pending'],
    });

    expect(facts).toMatchObject({ word: 'Waits for you', wait: 'go' });
  });

  it.each([
    ['a stop for questions', { kind: 'questions', message: 'Asked.' }],
    ['a stop for permission', { kind: 'needs-approval', message: 'Blocked.' }],
    ['a plan that waits', { kind: 'plan-approval', message: 'Ready.' }],
    ['a pause', { kind: 'paused', message: 'Paused.' }],
    ['a stop by the person', { kind: 'closed', message: 'Closed.' }],
  ] as const)('raises nothing for %s, which other reasons already own', (_name, stop) => {
    expect(
      waitOf({ run: aWorkflowRun({ workflowId: WORKFLOW_ID, orchestrationStop: stop }) }).wait,
    ).toBeNull();
  });

  it('raises nothing while a step runs or the orchestrator decides', () => {
    const run = aWorkflowRun({ workflowId: WORKFLOW_ID });

    expect(waitOf({ run, statuses: ['completed', 'running', 'pending'] }).wait).toBeNull();
    expect(
      waitOf({ run, statuses: ['completed', 'pending', 'pending'], isOrchestrating: true }).wait,
    ).toBeNull();
  });

  it('raises nothing for an archived run, even one that stopped on a failure', () => {
    const facts = waitOf({
      run: aWorkflowRun({
        workflowId: WORKFLOW_ID,
        orchestrationStop: { kind: 'failure', message: 'The orchestrator failed.' },
        discardedAt: JSON.parse('"2026-10-16T09:00:00.000Z"'),
      }),
    });

    expect(facts).toMatchObject({ word: 'Archived', wait: null });
  });
});
