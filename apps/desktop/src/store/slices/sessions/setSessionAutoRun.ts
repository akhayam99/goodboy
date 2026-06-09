import type { IsoDateTime, SessionId } from '@goodboy/types';
import { updateSessionAutoRun, updateSessionWorkflowAutoRun } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const setSessionAutoRun = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId, autoRun: boolean) => {
    const now = new Date().toISOString() as IsoDateTime;
    const session = get().sessions.find((s) => s.id === sessionId);
    const liveRuns = (session?.workflowRuns ?? []).filter((r) => !r.discardedAt);
    await updateSessionAutoRun(tauriDatabase, sessionId, autoRun, now);
    for (const run of liveRuns) {
      await updateSessionWorkflowAutoRun(tauriDatabase, sessionId, run.id, autoRun, now);
    }
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              autoRun,
              workflowRuns: s.workflowRuns.map((r) => (r.discardedAt ? r : { ...r, autoRun })),
              updatedAt: now,
            }
          : s,
      ),
    }));
    if (autoRun) {
      void get().maybeAutoAdvanceWorkflow(sessionId);
    }
  };
};
