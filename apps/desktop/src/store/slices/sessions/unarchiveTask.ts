import type { Session, SessionId } from '@goodboy/types';
import {
  listWorktreesForSession,
  unarchiveSession as unarchiveSessionInDb,
  updateSessionActiveMount,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeAgentList } from '../../../features/workflows/workflows';
import { buildSessionMounts } from '../worktrees/buildSessionMounts';
import type { GetFn, SetFn } from './types';

export const unarchiveTask = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId) => {
    const archivedList = Object.values(get().archivedSessions).flat();
    const prev = archivedList.find((s) => s.id === sessionId);
    if (!prev) {
      return;
    }
    const workspaceId = prev.workspaceId;
    const { archivedAt: _drop, ...restored } = prev;
    const restoredSession = restored as Session;

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

    if (get().currentWorkspaceId !== workspaceId) {
      return;
    }
    try {
      const [worktreeRows, runs] = await Promise.all([
        listWorktreesForSession(tauriDatabase, sessionId),
        invokeAgentList(sessionId),
      ]);
      const workspace = get().workspaces.find((candidate) => candidate.id === workspaceId) ?? null;
      const mounts = buildSessionMounts({ workspace, rows: worktreeRows });
      const storedActiveMount = restoredSession.activeMountWorkspaceId;
      const hasStoredActiveMount =
        storedActiveMount != null &&
        mounts.some((mount) => mount.workspaceId === storedActiveMount);
      if (storedActiveMount != null && !hasStoredActiveMount) {
        await updateSessionActiveMount({ db: tauriDatabase, id: sessionId, workspaceId: null });
      }
      let restoredWithValidActiveMount = restoredSession;
      if (storedActiveMount != null && !hasStoredActiveMount) {
        const { activeMountWorkspaceId: _drop, ...validSession } = restoredSession;
        restoredWithValidActiveMount = validSession;
      }
      set((state) => {
        const nextWorktrees = { ...state.sessionWorktrees };
        const nextBranches = { ...state.sessionBranches };
        const nextActiveMount = { ...state.sessionActiveMount };
        if (hasStoredActiveMount) {
          nextActiveMount[sessionId] = storedActiveMount;
        } else {
          delete nextActiveMount[sessionId];
        }
        if (worktreeRows.length > 0) {
          nextWorktrees[sessionId] = worktreeRows.map((r) => r.worktreePath);
          const primary = worktreeRows[0];
          if (primary) {
            nextBranches[sessionId] = primary.branch;
          }
        }
        return {
          sessions: state.sessions.map((candidate) =>
            candidate.id === sessionId ? restoredWithValidActiveMount : candidate,
          ),
          sessionWorktrees: nextWorktrees,
          sessionMounts: { ...state.sessionMounts, [sessionId]: mounts },
          sessionActiveMount: nextActiveMount,
          sessionBranches: nextBranches,
          sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: runs },
        };
      });
    } catch {}
  };
};
