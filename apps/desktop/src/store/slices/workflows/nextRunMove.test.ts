// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Agent, OpenQuestion, OpenQuestionId, Workflow, WorkflowRun } from '@goodboy/types';
import { aWorkflowRun, anAgent, TEST_NOW } from '@goodboy/types/testing';
import { nextRunMove } from './nextRunMove';

const WORKFLOW_ID = 'workflow-settlement-run' as Workflow['id'];

const stepOf = (ordinal: number): Workflow['steps'][number] => ({
  id: `step-${ordinal}` as Workflow['steps'][number]['id'],
  workflowId: WORKFLOW_ID,
  ordinal,
  name: `Step ${ordinal}`,
  promptPrefix: '',
});

const workflowOf = (ordinals: ReadonlyArray<number>): Workflow => ({
  id: WORKFLOW_ID,
  workspaceId: 'workspace-harborline' as Workflow['workspaceId'],
  name: 'Settlement run',
  description: '',
  steps: ordinals.map(stepOf),
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
});

const agentOf = (ordinal: number, status: Agent['status']): Agent =>
  anAgent({ stepId: stepOf(ordinal).id, ordinal, status });

const runOf = (overrides: Partial<WorkflowRun> = {}): WorkflowRun =>
  aWorkflowRun({ workflowId: WORKFLOW_ID, autoRun: true, ...overrides });

const questionFor = (run: WorkflowRun): OpenQuestion => ({
  id: 'question-1' as OpenQuestionId,
  sessionId: 'session-1' as OpenQuestion['sessionId'],
  workflowRunId: run.id,
  text: 'Which ledger?',
  suggestedAnswers: [],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: TEST_NOW,
});

describe('nextRunMove', () => {
  it('activates the first pending step once the steps before it are settled', () => {
    const pending = agentOf(1, 'pending');
    const move = nextRunMove({
      run: runOf(),
      template: workflowOf([0, 1, 2]),
      agents: [agentOf(0, 'completed'), pending, agentOf(2, 'pending')],
      openQuestions: [],
    });

    expect(move).toEqual({ kind: 'activate', agent: pending });
  });

  it('waits while an earlier step is still unsettled', () => {
    const move = nextRunMove({
      run: runOf(),
      template: workflowOf([0, 1]),
      agents: [agentOf(0, 'running'), agentOf(1, 'pending')],
      openQuestions: [],
    });

    expect(move).toEqual({ kind: 'none' });
  });

  it('decides the next step of an orchestrated run once every agent is settled', () => {
    const move = nextRunMove({
      run: runOf({ executionMode: 'dynamic' }),
      template: workflowOf([0]),
      agents: [agentOf(0, 'completed')],
      openQuestions: [],
    });

    expect(move).toEqual({ kind: 'decide' });
  });

  it('does not decide for a run that already has its outcome', () => {
    const move = nextRunMove({
      run: runOf({ executionMode: 'dynamic', orchestrationOutcome: 'done' }),
      template: workflowOf([0]),
      agents: [agentOf(0, 'completed')],
      openQuestions: [],
    });

    expect(move).toEqual({ kind: 'none' });
  });

  it('does not decide while an agent of the run failed', () => {
    const move = nextRunMove({
      run: runOf({ executionMode: 'dynamic' }),
      template: workflowOf([0]),
      agents: [agentOf(0, 'failed')],
      openQuestions: [],
    });

    expect(move).toEqual({ kind: 'none' });
  });

  it('does nothing while the run waits on an answer', () => {
    const run = runOf({ executionMode: 'dynamic' });
    const move = nextRunMove({
      run,
      template: workflowOf([0]),
      agents: [agentOf(0, 'completed')],
      openQuestions: [questionFor(run)],
    });

    expect(move).toEqual({ kind: 'none' });
  });

  it('does nothing for a run whose workflow is not loaded', () => {
    const move = nextRunMove({
      run: runOf({ executionMode: 'dynamic' }),
      template: undefined,
      agents: [],
      openQuestions: [],
    });

    expect(move).toEqual({ kind: 'none' });
  });
});
