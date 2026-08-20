import { upsertSessionExternalTask } from '@goodboy/db';
import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { resolveSessionRepo } from '../worktrees/resolveSessionRepo';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

export const linkSessionExternalTask = ({ set, get }: Params) => {
  return async (
    sessionId: SessionId,
    task: Omit<SessionExternalTask, 'sessionId'>,
  ): Promise<void> => {
    const state = get();
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    const workspace = state.workspaces.find((candidate) => candidate.id === session?.workspaceId);
    const repo = workspace?.kind === 'composite' ? resolveSessionRepo({ state, sessionId }) : null;
    const mountWorkspaceId = task.mountWorkspaceId ?? repo?.workspaceId;
    const branch = task.branch ?? repo?.branch ?? state.sessionBranches[sessionId] ?? null;
    const linkedTask: SessionExternalTask = {
      ...task,
      sessionId,
      ...(mountWorkspaceId != null ? { mountWorkspaceId } : {}),
      ...(branch != null && branch !== '' ? { branch } : {}),
    };
    await upsertSessionExternalTask({ db: tauriDatabase, task: linkedTask });
    set((state) => {
      const current = state.sessionExternalTasks[sessionId] ?? [];
      const matchingIndex = current.findIndex(
        (candidate) =>
          candidate.provider === linkedTask.provider &&
          candidate.externalId === linkedTask.externalId &&
          candidate.mountWorkspaceId === linkedTask.mountWorkspaceId,
      );
      const next =
        matchingIndex < 0
          ? [...current, linkedTask]
          : current.map((candidate, index) => (index === matchingIndex ? linkedTask : candidate));
      return {
        sessionExternalTasks: { ...state.sessionExternalTasks, [sessionId]: next },
      };
    });
    await get().recordSessionEvent({
      sessionId,
      kind: 'issue_linked',
      payload: {
        provider: linkedTask.provider,
        identifier: linkedTask.identifier,
        title: linkedTask.title,
        url: linkedTask.url,
      },
    });
  };
};
