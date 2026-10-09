// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { OpenQuestion, OpenQuestionId, Workflow, WorkflowRun } from '@goodboy/types';
import { aSession, aWorkflowRun, anAgent, TEST_NOW } from '@goodboy/types/testing';
import { findIdleRuns } from './findIdleRuns';

const WORKFLOW_ID = 'workflow-settlement-run' as Workflow['id'];

const template = (workspaceId: Workflow['workspaceId']): Workflow => ({
  id: WORKFLOW_ID,
  workspaceId,
  name: 'Orchestrated workflow',
  description: '',
  steps: [],
  origin: 'orchestrated',
  createdAt: TEST_NOW,
  updatedAt: TEST_NOW,
});

type Scene = {
  readonly run?: Partial<WorkflowRun>;
  readonly archivedAt?: boolean;
  readonly questions?: ReadonlyArray<OpenQuestion>;
  readonly isDeciding?: boolean;
  readonly isPending?: boolean;
  readonly isAdvancing?: boolean;
  readonly hasTemplate?: boolean;
};

const idleRunsOf = ({
  run = {},
  archivedAt = false,
  questions = [],
  isDeciding = false,
  isPending = false,
  isAdvancing = false,
  hasTemplate = true,
}: Scene = {}) => {
  const base = aWorkflowRun({
    workflowId: WORKFLOW_ID,
    executionMode: 'dynamic',
    autoRun: true,
    triggerMode: 'immediate',
    ...run,
  });
  const session = aSession({
    workflowRuns: [base],
    ...(archivedAt && { archivedAt: TEST_NOW }),
  });
  return findIdleRuns({
    sessions: [session],
    sessionPhaseRuns: {},
    phaseTemplates: hasTemplate ? { [session.workspaceId]: [template(session.workspaceId)] } : {},
    sessionOpenQuestions: { [session.id]: questions },
    orchestratingWorkflowRuns: isDeciding ? { [base.id]: true } : {},
    pendingOrchestrations: isPending ? { [base.id]: {} } : {},
    isSessionAdvancing: () => isAdvancing,
  });
};

const question = (run: WorkflowRun): OpenQuestion => ({
  id: 'question-settlement-alias' as OpenQuestionId,
  sessionId: 'session-1' as OpenQuestion['sessionId'],
  workflowRunId: run.id,
  text: 'Keep the legacy settlement route as an alias?',
  suggestedAnswers: [],
  isBlocking: true,
  userAnswer: null,
  status: 'open',
  createdAt: TEST_NOW,
});

describe('findIdleRuns', () => {
  it('finds an orchestrated autorun run with nothing running and nothing to wait for', () => {
    expect(idleRunsOf().map((idle) => idle.move.kind)).toEqual(['decide']);
  });

  it('marks a run that never got its first step as fresh', () => {
    expect(idleRunsOf().map((idle) => idle.isFresh)).toEqual([true]);
  });

  it('leaves a run that asks before each step to you', () => {
    expect(idleRunsOf({ run: { autoRun: false } })).toEqual([]);
  });

  it('leaves a static run to the autorun that already drives it', () => {
    expect(idleRunsOf({ run: { executionMode: 'static' } })).toEqual([]);
  });

  it('leaves a queued or chained run until it is started', () => {
    expect(idleRunsOf({ run: { triggerMode: 'manual' } })).toEqual([]);
    expect(idleRunsOf({ run: { triggerMode: 'after_run' } })).toEqual([]);
  });

  it('leaves a run that ended, was discarded or already says why it stopped', () => {
    expect(idleRunsOf({ run: { orchestrationOutcome: 'done' } })).toEqual([]);
    expect(idleRunsOf({ run: { discardedAt: TEST_NOW } })).toEqual([]);
    expect(
      idleRunsOf({ run: { orchestrationStop: { kind: 'paused', message: 'Paused by you.' } } }),
    ).toEqual([]);
    expect(
      idleRunsOf({ run: { orchestrationStop: { kind: 'failure', message: 'It failed.' } } }),
    ).toEqual([]);
  });

  it('leaves a run while a decision is in flight or queued behind one', () => {
    expect(idleRunsOf({ isDeciding: true })).toEqual([]);
    expect(idleRunsOf({ isPending: true })).toEqual([]);
  });

  it('leaves a session whose advance is already running', () => {
    expect(idleRunsOf({ isAdvancing: true })).toEqual([]);
  });

  it('leaves an archived session', () => {
    expect(idleRunsOf({ archivedAt: true })).toEqual([]);
  });

  it('leaves a run whose workflow is not loaded', () => {
    expect(idleRunsOf({ hasTemplate: false })).toEqual([]);
  });

  it('leaves a run that waits on an answer from you', () => {
    const run = aWorkflowRun({ id: 'run-held' as WorkflowRun['id'] });
    expect(idleRunsOf({ run: { id: run.id }, questions: [question(run)] })).toEqual([]);
  });

  it('leaves a run with a step in flight', () => {
    const run = aWorkflowRun({
      workflowId: WORKFLOW_ID,
      executionMode: 'dynamic',
      autoRun: true,
    });
    const session = aSession({ workflowRuns: [run] });
    const idle = findIdleRuns({
      sessions: [session],
      sessionPhaseRuns: {
        [session.id]: [
          anAgent({ sessionId: session.id, workflowRunId: run.id, status: 'running' }),
        ],
      },
      phaseTemplates: { [session.workspaceId]: [template(session.workspaceId)] },
      sessionOpenQuestions: {},
      orchestratingWorkflowRuns: {},
      pendingOrchestrations: {},
      isSessionAdvancing: () => false,
    });

    expect(idle).toEqual([]);
  });
});
