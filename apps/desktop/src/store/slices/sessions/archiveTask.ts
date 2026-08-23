import type { IsoDateTime, Session, SessionId } from '@goodboy/types';
import { archiveSession as archiveSessionInDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { dropPendingTurnEvents } from '../transcripts/buffer';
import type { GetFn, SetFn } from './types';

export const archiveTask = (set: SetFn, get: GetFn) => {
  return async (sessionId: SessionId) => {
    const prev = get().sessions.find((s) => s.id === sessionId);
    if (!prev) {
      return;
    }
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

    dropPendingTurnEvents({
      agentIds: (get().sessionPhaseRuns[sessionId] ?? []).map((agent) => agent.id),
    });
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
      const nextWorktreeRecords = { ...state.sessionWorktreeRecords };
      delete nextWorktreeRecords[sessionId];
      const nextMounts = { ...state.sessionProjectMounts };
      delete nextMounts[sessionId];
      const nextActiveMount = { ...state.sessionActiveProject };
      delete nextActiveMount[sessionId];
      const nextBranches = { ...state.sessionBranches };
      delete nextBranches[sessionId];
      const nextPhaseRuns = { ...state.sessionPhaseRuns };
      delete nextPhaseRuns[sessionId];
      const nextGithub = { ...state.sessionGithub };
      delete nextGithub[sessionId];
      const nextProjectPrs = { ...state.sessionProjectPrs };
      delete nextProjectPrs[sessionId];
      const nextSelectedPrNumber = { ...state.sessionSelectedPrNumber };
      delete nextSelectedPrNumber[sessionId];
      const nextLoading = { ...state.sessionLoading };
      delete nextLoading[sessionId];
      const nextSelected = { ...state.selectedAgentId };
      delete nextSelected[sessionId];
      const nextOpenQs = { ...state.sessionOpenQuestions };
      delete nextOpenQs[sessionId];
      const nextWorkflows = { ...state.sessionWorkflows };
      delete nextWorkflows[sessionId];
      return {
        transcripts: nextTranscripts,
        messages: nextMessages,
        sessionWorktrees: nextWorktrees,
        sessionWorktreeRecords: nextWorktreeRecords,
        sessionProjectMounts: nextMounts,
        sessionActiveProject: nextActiveMount,
        sessionBranches: nextBranches,
        sessionPhaseRuns: nextPhaseRuns,
        sessionGithub: nextGithub,
        sessionProjectPrs: nextProjectPrs,
        sessionSelectedPrNumber: nextSelectedPrNumber,
        sessionLoading: nextLoading,
        selectedAgentId: nextSelected,
        sessionOpenQuestions: nextOpenQs,
        sessionWorkflows: nextWorkflows,
      };
    });
  };
};
