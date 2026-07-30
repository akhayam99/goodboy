import type { IsoDateTime, SessionId, WorkflowRunId } from '@goodboy/types';
import { updateSessionWorkflowTriggerMode } from '@goodboy/db';
import { runsForWorkflowRun } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const startWorkflowRun = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, workflowRunId: WorkflowRunId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) {
      return;
    }
    const run = session.workflowRuns.find((r) => r.id === workflowRunId);
    if (!run || run.discardedAt || run.triggerMode === 'immediate') {
      return;
    }

    const now = new Date().toISOString() as IsoDateTime;
    await updateSessionWorkflowTriggerMode(
      tauriDatabase,
      sessionId,
      workflowRunId,
      'immediate',
      now,
    );
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === sessionId
          ? {
              ...sess,
              workflowRuns: sess.workflowRuns.map((r) =>
                r.id === workflowRunId ? { ...r, triggerMode: 'immediate' as const } : r,
              ),
              updatedAt: now,
            }
          : sess,
      ),
    }));

    if (run.autoRun) {
      void get().maybeAutoAdvanceWorkflow(sessionId);
      return;
    }
    const firstPending = [
      ...runsForWorkflowRun(get().sessionPhaseRuns[sessionId] ?? [], workflowRunId),
    ]
      .sort((a, b) => a.ordinal - b.ordinal)
      .find((r) => r.status === 'pending');
    if (firstPending) {
      await get().activateWorkflowAgent(sessionId, firstPending.id);
      return;
    }
    if (run.executionMode === 'dynamic') {
      await get().orchestrateNextStep(sessionId, workflowRunId);
    }
  };
};
