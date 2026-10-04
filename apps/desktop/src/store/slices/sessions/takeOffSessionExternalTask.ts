import type { SessionExternalTask, SessionId } from '@goodboy/types';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
};

type TakeOffParams = {
  readonly sessionId: SessionId;
  readonly task: SessionExternalTask;
};

export const takeOffSessionExternalTask = ({ get }: Params) => {
  return async ({ sessionId, task }: TakeOffParams): Promise<void> => {
    if (task.scope !== 'branch') {
      return;
    }
    const remaining = (get().sessionExternalTasks[sessionId] ?? []).filter(
      (candidate) =>
        candidate.provider === task.provider &&
        candidate.externalId === task.externalId &&
        candidate.scope === 'branch' &&
        !(candidate.branch === task.branch && candidate.projectId === task.projectId),
    );
    if (remaining.length === 0) {
      await get().linkSessionExternalTask(sessionId, { ...task, scope: 'session' });
    }
    await get().unlinkSessionExternalTask(
      sessionId,
      task.provider,
      task.externalId,
      task.projectId,
      task.branch,
    );
  };
};
