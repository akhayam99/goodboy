import type { IsoDateTime, ProviderRunId, SessionId, WorkspaceId } from '@goodboy/types';
import { disconnectWorkspace as disconnectWorkspaceInDb } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import { invokeTerminalClose } from '../../../features/terminal/terminal';
import type { GetFn, SetFn } from './types';

export const deleteWorkspace = (set: SetFn, get: GetFn) => {
  return async (id: WorkspaceId) => {
    const state = get();
    const workspace = state.workspaces.find((w) => w.id === id);
    if (!workspace) throw new Error(`workspace not found: ${id}`);

    // Cancel any running turns for this workspace so we don't leak processes
    // emitting events into a workspace the user can no longer see.
    const wasCurrentWorkspace = state.currentWorkspaceId === id;
    if (wasCurrentWorkspace) {
      const runningSessions = state.sessions.filter((s) => s.state.kind === 'running');
      await Promise.all(
        runningSessions.map((s) =>
          cancelTurn((s.state as { kind: 'running'; runId: ProviderRunId }).runId).catch(() => {
            // best-effort: registry may already be clean
          }),
        ),
      );
      // Best-effort: kill terminal shells for all sessions in this workspace.
      const termSessions = state.sessions.filter(
        (s) => state.terminalSessions[s.id as SessionId] === 'open',
      );
      void Promise.all(
        termSessions.map((s) => invokeTerminalClose(s.id as SessionId).catch(() => undefined)),
      );
    }

    const now = new Date().toISOString() as IsoDateTime;
    const prevWorkspaces = state.workspaces;

    // Optimistic: drop from sidebar list (and clear per-ws caches if it was
    // the active one).
    set((s) => {
      const nextArchived = { ...s.archivedSessions };
      delete nextArchived[id];
      return {
        workspaces: s.workspaces.filter((w) => w.id !== id),
        archivedSessions: nextArchived,
        ...(wasCurrentWorkspace
          ? {
              currentWorkspaceId: null,
              currentSessionId: null,
              sessions: [],
              sessionSummary: null,
              workspaceSummary: null,
              transcripts: {},
              messages: {},
              sessionTelemetry: {},
              sessionSlots: {},
              slotHistory: {},
              sessionWorktrees: {},
              sessionPhaseRuns: {},
              selectedAgentId: {},
              agentRunHistory: {},
              agentTurnState: {},
              sessionBudgets: {},
              summarizerStatus: {},
              sessionNextActions: {},
              budgetAlerts: [],
              unknownPayloadCounts: {},
              terminalSessions: {},
            }
          : {}),
      };
    });

    try {
      await disconnectWorkspaceInDb(tauriDatabase, id, now);
    } catch (err) {
      set((s) => ({
        workspaces: prevWorkspaces,
        ...(wasCurrentWorkspace ? { currentWorkspaceId: id } : {}),
      }));
      throw err;
    }
    void get().emitNotification(
      'workspace-deleted',
      'info',
      `Workspace disconnected: ${workspace.name}`,
      'Re-add the same path to bring it back with all its sessions.',
    );
  };
};
