import type { SessionId } from '@goodboy/types';
import { getWorkspaceById, insertSessionWorktree, listWorktreesForSession } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { writeSessionMarker } from '../../../features/worktree/worktree';
import { prepareSessionContainer } from '../../../features/workspace/prepareSessionContainer';
import { resolveSessionsRoot } from './sessionsRoot';
import { slugifyDir } from './slugifyDir';
import type { GetFn, SetFn } from './types';

export type EnsureSessionContainerInput = {
  readonly sessionId: SessionId;
};

const inFlight = new Map<SessionId, Promise<string>>();

export const ensureSessionContainer = (set: SetFn, get: GetFn) => {
  const adopt = ({ sessionId, containerDir }: { sessionId: SessionId; containerDir: string }) => {
    set((state) => {
      const known = state.sessionWorktrees[sessionId] ?? [];
      if (known.includes(containerDir)) {
        return {};
      }
      return {
        sessionWorktrees: {
          ...state.sessionWorktrees,
          [sessionId]: [containerDir, ...known],
        },
      };
    });
  };
  const run = async ({ sessionId }: EnsureSessionContainerInput): Promise<string> => {
    const known = (get().sessionWorktrees[sessionId] ?? [])[0] ?? null;
    if (known !== null) {
      return known;
    }
    const rows = await listWorktreesForSession(tauriDatabase, sessionId);
    const persisted = rows.find((row) => row.projectId === undefined && row.parallelIndex === 0);
    if (persisted !== undefined) {
      adopt({ sessionId, containerDir: persisted.worktreePath });
      return persisted.worktreePath;
    }
    const session =
      get().sessions.find((candidate) => candidate.id === sessionId) ??
      Object.values(get().archivedSessions)
        .flat()
        .find((candidate) => candidate.id === sessionId);
    if (session === undefined) {
      throw new Error(`session not found: ${sessionId}`);
    }
    const workspace =
      get().workspaces.find((candidate) => candidate.id === session.workspaceId) ??
      (await getWorkspaceById({ db: tauriDatabase, id: session.workspaceId }));
    if (workspace === null) {
      throw new Error(`workspace not found: ${session.workspaceId}`);
    }
    const dirSlug = `${slugifyDir(session.goal)}-${sessionId.slice(0, 8)}`;
    const sessionsRoot = resolveSessionsRoot({ workspace });
    const containerDir = await prepareSessionContainer({ path: `${sessionsRoot}/${dirSlug}` });
    await writeSessionMarker({ path: containerDir, sessionId, workspaceId: session.workspaceId });
    await insertSessionWorktree(tauriDatabase, {
      id: crypto.randomUUID(),
      sessionId,
      worktreePath: containerDir,
      branch: '',
      parallelIndex: 0,
      createdAt: Date.now(),
    });
    adopt({ sessionId, containerDir });
    await get().recordSessionEvent({
      sessionId,
      kind: 'worktree_created',
      payload: { worktreePath: containerDir },
    });
    return containerDir;
  };
  return async ({ sessionId }: EnsureSessionContainerInput): Promise<string> => {
    const pending = inFlight.get(sessionId);
    if (pending !== undefined) {
      return pending;
    }
    const promise = run({ sessionId }).finally(() => {
      inFlight.delete(sessionId);
    });
    inFlight.set(sessionId, promise);
    return promise;
  };
};
