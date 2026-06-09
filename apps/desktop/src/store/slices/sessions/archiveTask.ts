import type { IsoDateTime, Session, SessionId } from '@goodboy/types';
import { archiveSession as archiveSessionInDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

export const archiveTask = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId) => {
    const prev = get().sessions.find((s) => s.id === sessionId);
    if (!prev) return;
    const nowIso = new Date().toISOString() as IsoDateTime;
    const archived: Session = { ...prev, archivedAt: nowIso };
    const workspaceId = prev.workspaceId;

    set((state) => {
      const cached = state.archivedSessions[workspaceId];
      const nextArchived = cached
        ? { ...state.archivedSessions, [workspaceId]: [archived, ...cached] }
        : state.archivedSessions;
      return {
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        archivedSessions: nextArchived,
        currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
      };
    });

    try {
      await archiveSessionInDb(tauriDatabase, sessionId);
    } catch (err) {
      set((state) => {
        const cached = state.archivedSessions[workspaceId];
        const nextArchived = cached
          ? { ...state.archivedSessions, [workspaceId]: cached.filter((s) => s.id !== sessionId) }
          : state.archivedSessions;
        return {
          sessions: [...state.sessions, prev],
          archivedSessions: nextArchived,
        };
      });
      throw err;
    }

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
      return {
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
      };
    });
  };
};
