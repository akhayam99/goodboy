import { deleteSessionExternalTask } from '@goodboy/db';
import type { SessionExternalTaskProvider, SessionId, WorkspaceId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

export const unlinkSessionExternalTask = ({ set }: Params) => {
  return async (
    sessionId: SessionId,
    provider: SessionExternalTaskProvider,
    externalId: string,
    mountWorkspaceId?: WorkspaceId,
  ): Promise<void> => {
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
  };
};
