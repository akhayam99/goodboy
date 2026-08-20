import { deleteSessionExternalTask } from '@goodboy/db';
import type { SessionExternalTaskProvider, SessionId, WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
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
    mountWorkspaceId?: WorkspaceId,
  ): Promise<void> => {
    const unlinked =
      (get().sessionExternalTasks[sessionId] ?? []).find(
        (task) =>
          task.provider === provider &&
          task.externalId === externalId &&
          task.mountWorkspaceId === mountWorkspaceId,
      ) ?? null;
    await deleteSessionExternalTask({
      db: tauriDatabase,
      sessionId,
      provider,
      externalId,
      ...(mountWorkspaceId != null ? { mountWorkspaceId } : {}),
    });
    set((state) => ({
      sessionExternalTasks: {
        ...state.sessionExternalTasks,
        [sessionId]: (state.sessionExternalTasks[sessionId] ?? []).filter(
          (task) =>
            task.provider !== provider ||
            task.externalId !== externalId ||
            task.mountWorkspaceId !== mountWorkspaceId,
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
