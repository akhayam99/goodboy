import { deleteSessionExternalTask } from '@goodboy/db';
import type {
  ProjectId,
  SessionExternalTask,
  SessionExternalTaskProvider,
  SessionId,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { externalTaskLinkKey } from './externalTaskLinkKey';
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
    const scoped = branchLink === undefined ? {} : { scope: 'branch' as const, branch: branchLink };
    const key = externalTaskLinkKey({
      task: { provider, externalId, ...(projectId != null ? { projectId } : {}), ...scoped },
    });
    const isTarget = (task: SessionExternalTask): boolean => externalTaskLinkKey({ task }) === key;
    const unlinked = (get().sessionExternalTasks[sessionId] ?? []).find(isTarget) ?? null;
    await deleteSessionExternalTask({
      db: tauriDatabase,
      sessionId,
      provider,
      externalId,
      ...(projectId != null ? { projectId } : {}),
      ...scoped,
    });
    set((state) => ({
      sessionExternalTasks: {
        ...state.sessionExternalTasks,
        [sessionId]: (state.sessionExternalTasks[sessionId] ?? []).filter(
          (task) => !isTarget(task),
        ),
      },
    }));
    if (unlinked == null) {
      return;
    }
    await get().recordSessionEvent({
      sessionId,
      kind: 'issue_unlinked',
      payload: {
        provider: unlinked.provider,
        identifier: unlinked.identifier,
        title: unlinked.title,
        url: unlinked.url,
      },
    });
  };
};
