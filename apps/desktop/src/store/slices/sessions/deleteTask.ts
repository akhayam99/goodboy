import type { ProviderRunId, SessionId } from '@goodboy/types';
import { deleteSession as deleteSessionFromDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import { removeWorktree } from '../../../features/worktree/worktree';
import type { GetFn, SetFn } from './types';

export const deleteTask = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new Error(`session not found: ${sessionId}`);
    }
    get().closeSessionTerminals(sessionId);
    if (session.state.kind === 'running') {
      await cancelTurn((session.state as { kind: 'running'; runId: ProviderRunId }).runId).catch(
        () => undefined,
      );
    }
    const worktreePaths = get().sessionWorktrees[sessionId] ?? [];
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    if (workspace) {
      for (const worktreePath of worktreePaths) {
        try {
          await removeWorktree(workspace.rootPath, worktreePath);
        } catch {
          // worktree may already be gone
        }
      }
    }
    const sessionGoal = session.goal;
    const sessionWorkspaceId = session.workspaceId;
    await deleteSessionFromDb(tauriDatabase, sessionId);
    set((state) => {
      const nextWorktrees = { ...state.sessionWorktrees };
      delete nextWorktrees[sessionId];
      const nextBranches = { ...state.sessionBranches };
      delete nextBranches[sessionId];
      const nextTranscripts = { ...state.transcripts };
      for (const agent of state.sessionPhaseRuns[sessionId] ?? []) {
        delete nextTranscripts[agent.id];
      }
      return {
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
        sessionWorktrees: nextWorktrees,
        sessionBranches: nextBranches,
        transcripts: nextTranscripts,
      };
    });
    void get().emitNotification(
      'session-deleted',
      'info',
      `session deleted: ${sessionGoal}`,
      undefined,
      { workspaceId: sessionWorkspaceId },
    );
  };
};
