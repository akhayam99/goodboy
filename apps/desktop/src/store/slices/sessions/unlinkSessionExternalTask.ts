import type { ProjectId, SessionExternalTaskProvider, SessionId } from '@goodboy/types';
import { taskIdentityKey } from '../../../shared/utils/taskIdentityKey';
import { replaceTaskLinks } from './replaceTaskLinks';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const unlinkSessionExternalTask = ({ set, get }: Params) => {
  return async (
    sessionId: SessionId,
    provider: SessionExternalTaskProvider,
    externalId: string,
    projectId?: ProjectId,
    branchLink?: string,
  ): Promise<void> => {
    const key = taskIdentityKey({ task: { provider, externalId, projectId } });
    const before = (get().sessionExternalTasks[sessionId] ?? []).filter(
      (row) => taskIdentityKey({ task: row }) === key,
    );
    const task = before[0];
    if (task === undefined) {
      return;
    }
    const after =
      branchLink === undefined
        ? []
        : before.filter((row) => row.scope !== 'branch' || row.branch !== branchLink);
    if (after.length === before.length) {
      return;
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
      throw new Error('This task changed. Try unlinking it again.');
    }
    const id = get().undoable({
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
    await get().recordSessionEvent({
      sessionId,
      kind: 'issue_unlinked',
      payload: {
        provider: task.provider,
        externalId: task.externalId,
        projectId: task.projectId,
        identifier: task.identifier,
        title: task.title,
        url: task.url,
        taskOperation: { id, before, after },
      },
    });
  };
};
