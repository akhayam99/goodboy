import { listExternalTasksForWorkspace } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { refreshWorktreeStatuses } from '../worktreeStatuses/cache';
import { invalidateLocalBranchesCache } from '../../../features/worktree/worktree';
import { tauriDatabase } from '../../../shared/lib/db';
import { listSessionPrFetches } from '../github/resolveSessionPrFetch';
import type { GetFn, ResyncSessionParams, SetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';

type SessionParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
};

type ReadParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

const markSyncing = ({ set, sessionId }: SessionParams): void => {
  set((state) => ({ sessionSyncing: { ...state.sessionSyncing, [sessionId]: true } }));
};

const clearSyncing = ({ set, sessionId }: SessionParams): void => {
  set((state) => {
    if (state.sessionSyncing[sessionId] === undefined) {
      return state;
    }
    const sessionSyncing = { ...state.sessionSyncing };
    delete sessionSyncing[sessionId];
    return { sessionSyncing };
  });
};

const reloadLinkedTasks = async ({
  set,
  get,
  sessionId,
}: SessionParams & ReadParams): Promise<void> => {
  const session = sessionById(get().sessions, sessionId);
  if (session === undefined) {
    return;
  }
  const tasks = await listExternalTasksForWorkspace({
    db: tauriDatabase,
    workspaceId: session.workspaceId,
  });
  set((state) => ({
    sessionExternalTasks: {
      ...state.sessionExternalTasks,
      [sessionId]: tasks.filter((task) => task.sessionId === sessionId),
    },
  }));
};

const refreshLocalGit = async ({ get, sessionId }: ReadParams): Promise<void> => {
  const targets = listSessionPrFetches({ state: get(), sessionId });
  for (const target of targets) {
    invalidateLocalBranchesCache(target.mount.repoRoot);
  }
  await refreshWorktreeStatuses({ worktreePaths: targets.map((target) => target.cwd) });
};

const firstRequestError = ({ get, sessionId }: ReadParams): string | null => {
  const state = get();
  for (const { mount } of listSessionPrFetches({ state, sessionId })) {
    const error =
      state.mountGithub?.[mount.id]?.error ??
      state.mountGitlabMr?.[mount.id]?.error ??
      state.mountBitbucketPr?.[mount.id]?.error ??
      null;
    if (error !== null) {
      return error;
    }
  }
  return null;
};

export const resyncSession = (set: SetFn, get: GetFn) => {
  return async ({ sessionId }: ResyncSessionParams): Promise<void> => {
    if (get().sessionSyncing[sessionId] === true) {
      return;
    }
    markSyncing({ set, sessionId });
    try {
      await get().loadSessionMounts({ sessionId });
      await Promise.all([
        reloadLinkedTasks({ set, get, sessionId }),
        refreshLocalGit({ get, sessionId }),
        get().githubStatus?.available === true
          ? get().refreshSessionPr(sessionId, { force: true })
          : Promise.resolve(),
        get().refreshSessionMr(sessionId, { force: true }),
        get().refreshSessionBitbucketPr(sessionId, { force: true }),
      ]);
      if (get().currentSessionId === sessionId && get().sessionGithub[sessionId]?.pr != null) {
        await get().refreshSessionPrDetail(sessionId, { force: true });
      }
      const error = firstRequestError({ get, sessionId });
      if (error !== null) {
        throw new Error(error);
      }
    } finally {
      clearSyncing({ set, sessionId });
    }
  };
};
