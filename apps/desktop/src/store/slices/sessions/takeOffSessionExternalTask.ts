import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { removeSessionExternalTask } from './removeSessionExternalTask';
import { writeSessionExternalTask } from './writeSessionExternalTask';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type TakeOffParams = {
  readonly sessionId: SessionId;
  readonly task: SessionExternalTask;
};

export const takeOffSessionExternalTask = ({ set, get }: Params) => {
  const write = writeSessionExternalTask({ set, get });
  const remove = removeSessionExternalTask({ set, get });
  return async ({ sessionId, task }: TakeOffParams): Promise<void> => {
    if (task.scope !== 'branch') {
      return;
    }
    const remaining = (get().sessionExternalTasks[sessionId] ?? []).filter(
      (candidate) =>
        candidate.provider === task.provider &&
        candidate.externalId === task.externalId &&
        candidate.projectId === task.projectId &&
        candidate.scope === 'branch' &&
        candidate.branch !== task.branch,
    );
    if (remaining.length === 0) {
      await write({ sessionId, task: { ...task, scope: 'session' } });
    }
    await remove({
      sessionId,
      provider: task.provider,
      externalId: task.externalId,
      projectId: task.projectId,
      branchLink: task.branch,
    });
  };
};
