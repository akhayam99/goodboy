import type { ProviderRunId, SessionId } from '@goodboy/types';
import { deleteSession as deleteSessionFromDb, listWorktreesForSession } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import { removeWorktree } from '../../../features/worktree/worktree';
import type { GetFn, SetFn } from './types';

export const deleteTask = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId) => {
    const session =
      get().sessions.find((s) => s.id === sessionId) ??
      Object.values(get().archivedSessions)
        .flat()
        .find((s) => s.id === sessionId);
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
    let paths = worktreePaths;
    if (paths.length === 0) {
      try {
        const rows = await listWorktreesForSession(tauriDatabase, sessionId);
        paths = rows.map((r) => r.worktreePath);
      } catch {
        paths = [];
      }
    }
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    if (workspace && workspace.kind !== 'simple') {
      for (const worktreePath of paths) {
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
      const phaseRuns = state.sessionPhaseRuns[sessionId] ?? [];
      const nextTranscripts = { ...state.transcripts };
      const nextMessages = { ...state.messages };
      for (const agent of phaseRuns) {
        delete nextTranscripts[agent.id];
        delete nextMessages[agent.id];
      }
      const nextWorktrees = { ...state.sessionWorktrees };
      delete nextWorktrees[sessionId];
      const nextBranches = { ...state.sessionBranches };
      delete nextBranches[sessionId];
      const nextPhaseRuns = { ...state.sessionPhaseRuns };
      delete nextPhaseRuns[sessionId];
      const nextGithub = { ...state.sessionGithub };
      delete nextGithub[sessionId];
      const nextLoading = { ...state.sessionLoading };
      delete nextLoading[sessionId];
      const nextSelected = { ...state.selectedAgentId };
      delete nextSelected[sessionId];
      const nextConflicts = { ...state.sessionMergeConflicts };
      delete nextConflicts[sessionId];
      const nextOpenQs = { ...state.sessionOpenQuestions };
      delete nextOpenQs[sessionId];
      const nextWorkflows = { ...state.sessionWorkflows };
      delete nextWorkflows[sessionId];
      const nextWorkflowDrafts = { ...state.workflowDrafts };
      delete nextWorkflowDrafts[sessionId];
      const cachedArchived = state.archivedSessions[sessionWorkspaceId];
      const nextArchived = cachedArchived
        ? {
            ...state.archivedSessions,
            [sessionWorkspaceId]: cachedArchived.filter((s) => s.id !== sessionId),
          }
        : state.archivedSessions;
      return {
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        archivedSessions: nextArchived,
        currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
        transcripts: nextTranscripts,
        messages: nextMessages,
        sessionWorktrees: nextWorktrees,
        sessionBranches: nextBranches,
        sessionPhaseRuns: nextPhaseRuns,
        sessionGithub: nextGithub,
        sessionLoading: nextLoading,
        selectedAgentId: nextSelected,
        sessionMergeConflicts: nextConflicts,
        sessionOpenQuestions: nextOpenQs,
        sessionWorkflows: nextWorkflows,
        workflowDrafts: nextWorkflowDrafts,
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
