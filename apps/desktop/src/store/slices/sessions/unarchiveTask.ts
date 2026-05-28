import type { Session, SessionId } from '@goodboy/types';
import { listWorktreesForSession, unarchiveSession as unarchiveSessionInDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentList } from '../../../features/workflows/workflows';
import type { GetFn, SetFn } from './types';

export function unarchiveTask(set: SetFn, get: GetFn) {
  return async (sessionId: SessionId) => {
    const archivedList = Object.values(get().archivedSessions).flat();
    const prev = archivedList.find((s) => s.id === sessionId);
    if (!prev) return;
    const workspaceId = prev.workspaceId;
    const { archivedAt: _drop, ...restored } = prev;
    const restoredSession = restored as Session;

    // Optimistic move: out of archived cache, into `sessions`.
    set((state) => {
      const cached = state.archivedSessions[workspaceId];
      const nextArchived = cached
        ? { ...state.archivedSessions, [workspaceId]: cached.filter((s) => s.id !== sessionId) }
        : state.archivedSessions;
      const isCurrentWorkspace = state.currentWorkspaceId === workspaceId;
      return {
        sessions: isCurrentWorkspace ? [restoredSession, ...state.sessions] : state.sessions,
        archivedSessions: nextArchived,
      };
    });

    try {
      await unarchiveSessionInDb(tauriDatabase, sessionId);
    } catch (err) {
      // Rollback move.
      set((state) => {
        const cached = state.archivedSessions[workspaceId];
        const nextArchived = cached
          ? { ...state.archivedSessions, [workspaceId]: [prev, ...cached] }
          : state.archivedSessions;
        return {
          sessions: state.sessions.filter((s) => s.id !== sessionId),
          archivedSessions: nextArchived,
        };
      });
      throw err;
    }

    // Repopulate per-session caches we cleared on archive (only meaningful if
    // we're on the same workspace, otherwise the next setCurrentWorkspace
    // will hydrate fresh).
    if (get().currentWorkspaceId !== workspaceId) return;
    try {
      const [worktreeRows, runs] = await Promise.all([
        listWorktreesForSession(tauriDatabase, sessionId),
        invokeAgentList(sessionId),
      ]);
      set((state) => {
        const nextWorktrees = { ...state.sessionWorktrees };
        const nextBranches = { ...state.sessionBranches };
        if (worktreeRows.length > 0) {
          nextWorktrees[sessionId] = worktreeRows.map((r) => r.worktreePath);
          const primary = worktreeRows[0];
          if (primary) nextBranches[sessionId] = primary.branch;
        }
        return {
          sessionWorktrees: nextWorktrees,
          sessionBranches: nextBranches,
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: runs },
        };
      });
    } catch {
      // Best-effort: setCurrentSession reloads on demand if the user opens it
    }
  };
}
