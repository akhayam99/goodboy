import type { ProviderRunId, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { deleteSession as deleteSessionFromDb, listWorktreesForSession } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import {
  removeSessionDirectory,
  removeWorktree,
  tidyRepoGoodboyDir,
} from '../../../features/worktree/worktree';
import { isBranchlessSession } from '../../../shared/utils/isBranchlessSession';
import { purgeSessionFileVersions } from '../file-versions/persistFinalizedFileVersions';
import { dropPendingTurnEvents } from '../transcripts/buffer';
import { forgetMaterializationSeed } from './materializationSeeds';
import type { GetFn, SetFn } from './types';

const removePersistedDirectory = async (path: string): Promise<void> => {
  const parent = path.slice(0, path.lastIndexOf('/'));
  if (parent === '') {
    throw new Error(`session path has no parent: ${path}`);
  }
  await removeSessionDirectory({ basePath: parent, path });
};

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
    const isBranchless = isBranchlessSession({
      branch: get().sessionBranches[sessionId],
    });
    const cleanupFailures: unknown[] = [];
    const projects = get().projects.filter(
      (project) => project.workspaceId === session.workspaceId,
    );
    const containerRow = rows.find((row) => row.projectId === undefined && row.parallelIndex === 0);
    const mountRows = rows.filter((row) => row !== containerRow);
    for (const row of mountRows) {
      const project =
        projects.find((candidate) => candidate.id === row.projectId) ??
        (row.projectId === undefined
          ? projects.find((candidate) => candidate.name === row.mountName)
          : undefined);
      if (project?.kind === 'repo') {
        try {
          await removeWorktree(project.rootPath, row.worktreePath);
          await tidyRepoGoodboyDir({ repoPath: project.rootPath }).catch(() => undefined);
        } catch (error) {
          cleanupFailures.push(error);
        }
        continue;
      }
      try {
        await removePersistedDirectory(row.worktreePath);
      } catch (error) {
        cleanupFailures.push(error);
      }
    }
    if (containerRow !== undefined) {
      try {
        await removePersistedDirectory(containerRow.worktreePath);
      } catch (error) {
        cleanupFailures.push(error);
      }
    }
    forgetMaterializationSeed({ sessionId });
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
      const nextGithubPrs = { ...state.sessionGithubPrs };
      delete nextGithubPrs[sessionId];
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
        sessionWorktreeRecords: nextWorktreeRecords,
        sessionProjectMounts: nextMounts,
        sessionActiveProject: nextActiveMount,
        sessionBranches: nextBranches,
        sessionPhaseRuns: nextPhaseRuns,
        sessionGithub: nextGithub,
        sessionGithubPrs: nextGithubPrs,
        sessionProjectPrs: nextProjectPrs,
        sessionSelectedPrNumber: nextSelectedPrNumber,
        sessionLoading: nextLoading,
        selectedAgentId: nextSelected,
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
