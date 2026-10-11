import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { taskIdentityKey } from '../../../shared/utils/taskIdentityKey';
import { externalTaskLinkKey } from './externalTaskLinkKey';
import { moveSessionExternalTask } from './moveSessionExternalTask';
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
  const move = moveSessionExternalTask({ set, get });
  return async ({ sessionId, task }: TakeOffParams): Promise<void> => {
    if (task.scope !== 'branch') {
      return;
    }
    const key = taskIdentityKey({ task });
    const others = (get().sessionExternalTasks[sessionId] ?? []).filter(
      (row) =>
        taskIdentityKey({ task: row }) === key &&
        externalTaskLinkKey({ task: row }) !== externalTaskLinkKey({ task }),
    );
    await move({
      sessionId,
      task,
      to: others.length === 0 ? { kind: 'session' } : { kind: 'off' },
    });
  };
};
