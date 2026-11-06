import type { IsoDateTime, SessionId, WorkspaceId } from '@goodboy/types';
import { disconnectWorkspaceAndProjects } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeTerminalClose } from '../../../features/terminal/terminal';
import { stopWork } from '../../runtime/live-work/stopWork';
import { clearPendingTurnEvents } from '../transcripts/buffer';
import type { GetFn, SetFn } from './types';

const STILL_RUNNING_MESSAGE =
  'An agent did not stop, so the workspace stays connected. Try Disconnect again.';

export const disconnectWorkspace = (set: SetFn, get: GetFn) => {
  return async (id: WorkspaceId) => {
    const state = get();
    const workspace = state.workspaces.find((w) => w.id === id);
    if (!workspace) {
      throw new Error(`workspace not found: ${id}`);
    }

    const wasCurrentWorkspace = state.currentWorkspaceId === id;
    if (wasCurrentWorkspace) {
      const { stillRunning } = await stopWork({
        getState: get,
        scope: { kind: 'all' },
        reason: 'leave',
      });
      if (stillRunning > 0) {
        throw new Error(STILL_RUNNING_MESSAGE);
      }
      const termSessions = state.sessions.filter(
        (s) => state.terminalSessions[s.id as SessionId] === 'open',
      );
      void Promise.all(
        termSessions.map((s) => invokeTerminalClose(s.id as SessionId).catch(() => undefined)),
      );
    }

    const now = new Date().toISOString() as IsoDateTime;
    const prevWorkspaces = state.workspaces;
    const prevProjects = state.projects;
    const ownedProjects = state.projects.filter((project) => project.workspaceId === id);

    if (wasCurrentWorkspace) {
      clearPendingTurnEvents();
    }
    set((s) => {
      const nextArchived = { ...s.archivedSessions };
      const workspaceIntegrations = { ...s.workspaceIntegrations };
      const projectScripts = { ...s.projectScripts };
      const workspaceOverrides = { ...s.workspaceOverrides };
      delete nextArchived[id];
      delete workspaceIntegrations[id];
      delete projectScripts[id];
      delete workspaceOverrides[id];
      return {
        workspaces: s.workspaces.filter((w) => w.id !== id),
        projects: s.projects.filter((project) => project.workspaceId !== id),
        archivedSessions: nextArchived,
        workspaceIntegrations,
        projectScripts,
        workspaceOverrides,
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
              slotHistoryCounts: {},
              sessionSlotsLoad: {},
              sessionWorktrees: {},
              sessionProjectMounts: {},
              sessionActiveProject: {},
              sessionActiveMount: {},
              sessionPhaseRuns: {},
              selectedAgentId: {},
              agentRunHistory: {},
              runRouting: {},
              agentTurnState: {},
              sessionBudgets: {},
              summarizerStatus: {},
              budgetAlerts: [],
              unknownPayloadCounts: {},
              terminalSessions: {},
            }
          : {}),
      };
    });

    try {
      await disconnectWorkspaceAndProjects({
        db: tauriDatabase,
        id,
        projectIds: ownedProjects.map((project) => project.id),
        at: now,
      });
    } catch (err) {
      set((s) => ({
        workspaces: prevWorkspaces,
        projects: prevProjects,
        ...(wasCurrentWorkspace ? { currentWorkspaceId: id } : {}),
      }));
      throw err;
    }
    void get().emitNotification({
      kind: 'workspace-deleted',
      severity: 'info',
      title: `Disconnected ${workspace.name}`,
      body: 'Re-add the same path to bring it back with all its sessions.',
    });
  };
};
