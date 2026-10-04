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

type RemoveParams = {
  readonly sessionId: SessionId;
  readonly provider: SessionExternalTaskProvider;
  readonly externalId: string;
  readonly projectId?: ProjectId;
  readonly branchLink?: string;
};

export const removeSessionExternalTask = ({ set, get }: Params) => {
  return async ({
    sessionId,
    provider,
    externalId,
    projectId,
    branchLink,
  }: RemoveParams): Promise<SessionExternalTask | null> => {
    const scoped = branchLink === undefined ? {} : { scope: 'branch' as const, branch: branchLink };
    const key = externalTaskLinkKey({
      task: { provider, externalId, ...(projectId != null ? { projectId } : {}), ...scoped },
    });
    const isTarget = (task: SessionExternalTask): boolean => externalTaskLinkKey({ task }) === key;
    const removed = (get().sessionExternalTasks[sessionId] ?? []).find(isTarget) ?? null;
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
    return removed;
  };
};
