import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IsoDateTime, SessionId, WorkflowId, WorkflowRunId } from '@goodboy/types';

const { restoreWorkflowInSessionSpy, recordSessionEventSpy } = vi.hoisted(() => ({
  restoreWorkflowInSessionSpy: vi.fn(),
  recordSessionEventSpy: vi.fn(),
}));

vi.mock('@goodboy/db', () => ({
  restoreWorkflowInSession: restoreWorkflowInSessionSpy,
}));

vi.mock('../../../shared/lib/db', () => ({
  tauriDatabase: {},
}));

import { restoreWorkflow } from './restoreWorkflow';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const WORKFLOW_ID = 'wf-1' as WorkflowId;
const DISCARDED_AT = '2026-08-21T10:00:00.000Z' as IsoDateTime;

type HarnessParams = {
  readonly discardedAt?: IsoDateTime;
  readonly workflowName?: string;
};

const buildHarness = ({ discardedAt, workflowName }: HarnessParams = {}) => {
  const state = {
    sessions: [
      {
        id: SESSION_ID,
        workflowRuns: [
          {
            id: RUN_ID,
            workflowId: WORKFLOW_ID,
            ...(discardedAt == null ? {} : { discardedAt }),
          },
        ],
      },
    ],
    sessionWorkflows:
      workflowName == null ? {} : { [SESSION_ID]: [{ id: WORKFLOW_ID, name: workflowName }] },
    recordSessionEvent: recordSessionEventSpy,
  };
  const set = vi.fn((updater: (s: typeof state) => Partial<typeof state>) => {
    Object.assign(state, updater(state));
  });
  const restore = restoreWorkflow(
    set as unknown as Parameters<typeof restoreWorkflow>[0],
    (() => state) as unknown as Parameters<typeof restoreWorkflow>[1],
  );
  return { restore, state };
};

describe('restoreWorkflow', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('records a workflow_restored event naming the run and the workflow', async () => {
    const { restore } = buildHarness({
      discardedAt: DISCARDED_AT,
      workflowName: 'Orchestrated workflow 24',
    });

    await restore(SESSION_ID, RUN_ID);

    expect(restoreWorkflowInSessionSpy).toHaveBeenCalledTimes(1);
    expect(recordSessionEventSpy).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'workflow_restored',
      payload: { runId: RUN_ID, workflowName: 'Orchestrated workflow 24' },
    });
  });

  it('omits the name when the session has no workflow for the run', async () => {
    const { restore } = buildHarness({ discardedAt: DISCARDED_AT });

    await restore(SESSION_ID, RUN_ID);

    expect(recordSessionEventSpy).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'workflow_restored',
      payload: { runId: RUN_ID },
    });
  });

  it('clears the discarded stamp it restores', async () => {
    const { restore, state } = buildHarness({ discardedAt: DISCARDED_AT });

    await restore(SESSION_ID, RUN_ID);

    expect(state.sessions[0]?.workflowRuns[0]).not.toHaveProperty('discardedAt');
  });

  it('records nothing for a run that was never discarded', async () => {
    const { restore } = buildHarness({ workflowName: 'Orchestrated workflow 24' });

    await restore(SESSION_ID, RUN_ID);

    expect(restoreWorkflowInSessionSpy).not.toHaveBeenCalled();
    expect(recordSessionEventSpy).not.toHaveBeenCalled();
  });

  it('records nothing for an unknown session', async () => {
    const { restore } = buildHarness({ discardedAt: DISCARDED_AT });

    await restore('session-missing' as SessionId, RUN_ID);

    expect(recordSessionEventSpy).not.toHaveBeenCalled();
  });
});
