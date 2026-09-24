import { describe, expect, it } from 'vitest';
import type { Session, SessionId, WorkflowRun, WorkflowRunId } from '@goodboy/types';
import { runProviderPool } from './runProviderPool';

const SESSION_ID = 'session-1' as SessionId;
const POOLED_RUN = 'run-pooled' as WorkflowRunId;
const OPEN_RUN = 'run-open' as WorkflowRunId;

const run = (overrides: Partial<WorkflowRun>): WorkflowRun =>
  ({
    id: OPEN_RUN,
    workflowId: 'workflow-1',
    ordinal: 0,
    currentStep: 0,
    autoRun: false,
    triggerMode: 'immediate',
    executionMode: 'dynamic',
    ...overrides,
  }) as WorkflowRun;

const sessions = [
  {
    id: SESSION_ID,
    workflowRuns: [run({ id: POOLED_RUN, providerPool: ['codex'] }), run({ id: OPEN_RUN })],
  } as unknown as Session,
];

describe('runProviderPool', () => {
  it('reads the pool the run was started with', () => {
    expect(runProviderPool({ sessions, sessionId: SESSION_ID, workflowRunId: POOLED_RUN })).toEqual(
      ['codex'],
    );
  });

  it('lets a run without a pool use every provider', () => {
    expect(
      runProviderPool({ sessions, sessionId: SESSION_ID, workflowRunId: OPEN_RUN }),
    ).toBeNull();
  });

  it('lets an agent outside any run use every provider', () => {
    expect(runProviderPool({ sessions, sessionId: SESSION_ID, workflowRunId: null })).toBeNull();
  });
});
