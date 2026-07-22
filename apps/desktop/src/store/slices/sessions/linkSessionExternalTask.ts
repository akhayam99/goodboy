import { upsertSessionExternalTask } from '@goodboy/db';
import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

export const linkSessionExternalTask = ({ set }: Params) => {
  return async (
    sessionId: SessionId,
    task: Omit<SessionExternalTask, 'sessionId'>,
  ): Promise<void> => {
    const linkedTask: SessionExternalTask = { ...task, sessionId };
    await upsertSessionExternalTask({ db: tauriDatabase, task: linkedTask });
    set((state) => {
      const current = state.sessionExternalTasks[sessionId] ?? [];
      const matchingIndex = current.findIndex(
        (candidate) =>
          candidate.provider === linkedTask.provider &&
          candidate.externalId === linkedTask.externalId,
      );
      const next =
        matchingIndex < 0
          ? [...current, linkedTask]
          : current.map((candidate, index) => (index === matchingIndex ? linkedTask : candidate));
      return {
        sessionExternalTasks: { ...state.sessionExternalTasks, [sessionId]: next },
      };
    });
  };
};
