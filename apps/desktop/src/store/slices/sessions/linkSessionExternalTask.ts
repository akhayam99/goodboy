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

export const linkSessionExternalTask = ({ set, get }: Params) => {
  return async (
    sessionId: SessionId,
    task: Omit<SessionExternalTask, 'sessionId'>,
  ): Promise<void> => {
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
    set((state) => {
      const current = state.sessionExternalTasks[sessionId] ?? [];
      const matchingIndex = current.findIndex(
        (candidate) => externalTaskLinkKey({ task: candidate }) === linkedKey,
      );
      const next =
        matchingIndex < 0
          ? [...current, linkedTask]
          : current.map((candidate, index) => (index === matchingIndex ? linkedTask : candidate));
      return {
        sessionExternalTasks: { ...state.sessionExternalTasks, [sessionId]: next },
      };
    });
    await get().recordSessionEvent({
      sessionId,
      kind: 'issue_linked',
      payload: {
        provider: linkedTask.provider,
        identifier: linkedTask.identifier,
        title: linkedTask.title,
        url: linkedTask.url,
      },
    });
  };
};
