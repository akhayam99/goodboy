import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { taskIdentityKey } from '../../../shared/utils/taskIdentityKey';
import { replaceTaskLinks } from './replaceTaskLinks';
import { externalTaskLinkKey } from './externalTaskLinkKey';
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
  return async ({ sessionId, task }: TakeOffParams): Promise<void> => {
    if (task.scope !== 'branch') {
      return;
    }
    const key = taskIdentityKey({ task });
    const before = (get().sessionExternalTasks[sessionId] ?? []).filter(
      (row) => taskIdentityKey({ task: row }) === key,
    );
    const after = before.filter(
      (row) => externalTaskLinkKey({ task: row }) !== externalTaskLinkKey({ task }),
    );
    if (before.length === after.length) {
      return;
    }
    if (
      !after.some((row) => row.scope === 'branch') &&
      !after.some((row) => row.scope !== 'branch')
    ) {
      after.push({ ...task, scope: 'session' });
    }
    const isCommitted = await replaceTaskLinks({
      set,
      get,
      sessionId,
      task,
      expected: before,
      next: after,
    });
    if (!isCommitted) {
      throw new Error('This task changed. Try taking it off again.');
    }
    get().undoable({
      message: `Unlinked ${task.identifier}`,
      conflictMessage: `${task.identifier} changed or was re-linked. Nothing changed.`,
      undo: () =>
        replaceTaskLinks({
          set,
          get,
          sessionId,
          task,
          expected: after,
          next: before,
          shouldCheckReferences: true,
        }),
    });
  };
};
