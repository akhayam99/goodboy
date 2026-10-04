import { upsertSessionExternalTask } from '@goodboy/db';
import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { resolveSessionRepo } from '../worktrees/resolveSessionRepo';
import { externalTaskLinkKey } from './externalTaskLinkKey';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type WriteParams = {
  readonly sessionId: SessionId;
  readonly task: Omit<SessionExternalTask, 'sessionId'>;
};

export const writeSessionExternalTask = ({ set, get }: Params) => {
  return async ({ sessionId, task }: WriteParams): Promise<SessionExternalTask> => {
    const state = get();
    const repo = resolveSessionRepo({ state, sessionId });
    const projectId = task.projectId ?? repo?.projectId;
    const branch = task.branch ?? repo?.branch ?? state.sessionBranches[sessionId] ?? null;
    if (task.scope === 'branch' && (branch === null || branch === '')) {
      throw new Error('This session has no branch yet. Link the task to the session instead.');
    }
    const linkedTask: SessionExternalTask = {
      ...task,
      sessionId,
      ...(projectId != null ? { projectId } : {}),
      ...(branch != null && branch !== '' ? { branch } : {}),
    };
    const linkedKey = externalTaskLinkKey({ task: linkedTask });
    await upsertSessionExternalTask({ db: tauriDatabase, task: linkedTask });
    set((current) => {
      const rows = current.sessionExternalTasks[sessionId] ?? [];
      const matchingIndex = rows.findIndex(
        (candidate) => externalTaskLinkKey({ task: candidate }) === linkedKey,
      );
      const next =
        matchingIndex < 0
          ? [...rows, linkedTask]
          : rows.map((candidate, index) => (index === matchingIndex ? linkedTask : candidate));
      return {
        sessionExternalTasks: { ...current.sessionExternalTasks, [sessionId]: next },
      };
    });
    return linkedTask;
  };
};
