import type { ProviderRunId, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import {
  deleteGithubPrCacheForWorktreePath,
  deleteSession as deleteSessionFromDb,
  listWorktreesForSession,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import { removeSessionDirectory, removeWorktree } from '../../../features/worktree/worktree';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { buildSessionMounts } from '../worktrees/buildSessionMounts';
import { purgeSessionFileVersions } from '../file-versions/persistFinalizedFileVersions';
import { dropPendingTurnEvents } from '../transcripts/buffer';
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
    await get()
      .closeSessionTerminals(sessionId)
      .catch(() => undefined);
    if (session.state.kind === 'running') {
      await cancelTurn((session.state as { kind: 'running'; runId: ProviderRunId }).runId).catch(
        () => undefined,
      );
    }
    const rows = await listWorktreesForSession(tauriDatabase, sessionId);
    const paths = rows.map((row) => row.worktreePath);
    const workspace = get().workspaces.find((w) => w.id === session.workspaceId);
    const isBranchless = isBranchlessSession({
      workspaceKind: workspace?.kind,
      branch: get().sessionBranches[sessionId],
    });
    const cleanupFailures: unknown[] = [];
    if (workspace?.kind === 'composite' && !isBranchless) {
      const mounts = buildSessionMounts({ workspace, rows });
      const memberCleanupFailures: unknown[] = [];
      for (const mount of mounts) {
        try {
          await removeWorktree(mount.repoRoot, mount.worktreePath);
        } catch (error) {
          memberCleanupFailures.push(error);
          cleanupFailures.push(error);
          continue;
        }
        try {
          await deleteGithubPrCacheForWorktreePath({
            db: tauriDatabase,
            worktreePath: mount.worktreePath,
          });
        } catch (error) {
          cleanupFailures.push(error);
        }
      }
      const containerPath = rows.find((row) => row.mountWorkspaceId == null)?.worktreePath;
      if (containerPath != null && memberCleanupFailures.length === 0) {
        try {
          await removeSessionDirectory({ basePath: workspace.rootPath, path: containerPath });
        } catch (error) {
          cleanupFailures.push(error);
        }
      }
    }
    if (workspace?.kind !== 'composite' && workspace != null && !isBranchless) {
      const worktreePath = paths[0];
      if (worktreePath != null) {
        let isWorktreeRemoved = false;
        try {
          await removeWorktree(workspace.rootPath, worktreePath);
          isWorktreeRemoved = true;
        } catch (error) {
          cleanupFailures.push(error);
        }
        if (isWorktreeRemoved) {
          try {
            await deleteGithubPrCacheForWorktreePath({ db: tauriDatabase, worktreePath });
          } catch (error) {
            cleanupFailures.push(error);
          }
        }
      }
    }
    if (cleanupFailures.length > 0) {
      void get().emitNotification(
        'error',
        'warning',
        `failed to remove ${cleanupFailures.length} session paths`,
        cleanupFailures.map((error) => formatError(error)).join('\n'),
        { sessionId, workspaceId: session.workspaceId },
      );
    }
    if (isBranchless) {
      await purgeSessionFileVersions({ sessionId });
    }
    const sessionGoal = session.goal;
    const sessionWorkspaceId = session.workspaceId;
    await deleteSessionFromDb(tauriDatabase, sessionId);
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
      const nextMounts = { ...state.sessionMounts };
      delete nextMounts[sessionId];
      const nextActiveMount = { ...state.sessionActiveMount };
      delete nextActiveMount[sessionId];
      const nextBranches = { ...state.sessionBranches };
      delete nextBranches[sessionId];
      const nextPhaseRuns = { ...state.sessionPhaseRuns };
      delete nextPhaseRuns[sessionId];
      const nextGithub = { ...state.sessionGithub };
      delete nextGithub[sessionId];
      const nextGithubPrs = { ...state.sessionGithubPrs };
      delete nextGithubPrs[sessionId];
      const nextSelectedPrNumber = { ...state.sessionSelectedPrNumber };
      delete nextSelectedPrNumber[sessionId];
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
      const nextFileVersions = { ...state.sessionFileVersions };
      delete nextFileVersions[sessionId];
      const nextFileVersionsLoading = { ...state.sessionFileVersionsLoading };
      delete nextFileVersionsLoading[sessionId];
      const nextFileVersionsPath = { ...state.sessionFileVersionSelectedPath };
      delete nextFileVersionsPath[sessionId];
      const nextSessionEvents = { ...state.sessionEvents };
      delete nextSessionEvents[sessionId];
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
        sessionMounts: nextMounts,
        sessionActiveMount: nextActiveMount,
        sessionBranches: nextBranches,
        sessionPhaseRuns: nextPhaseRuns,
        sessionGithub: nextGithub,
        sessionGithubPrs: nextGithubPrs,
        sessionSelectedPrNumber: nextSelectedPrNumber,
        sessionLoading: nextLoading,
        selectedAgentId: nextSelected,
        sessionMergeConflicts: nextConflicts,
        sessionOpenQuestions: nextOpenQs,
        sessionWorkflows: nextWorkflows,
        workflowDrafts: nextWorkflowDrafts,
        sessionFileVersions: nextFileVersions,
        sessionFileVersionsLoading: nextFileVersionsLoading,
        sessionFileVersionSelectedPath: nextFileVersionsPath,
        sessionEvents: nextSessionEvents,
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
