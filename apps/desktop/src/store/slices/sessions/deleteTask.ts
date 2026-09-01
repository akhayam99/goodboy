import type { ProviderRunId, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import {
  deleteGithubPrCacheForWorktreePath,
  listWorktreesForSession,
  purgeSessionForDelete,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { cancelTurn } from '../../../features/chat/turn';
import {
  removeSessionDirectory,
  removeWorktree,
  scratchDirRemove,
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
    for (const row of rows) {
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
          continue;
        }
        try {
          await deleteGithubPrCacheForWorktreePath({
            db: tauriDatabase,
            worktreePath: row.worktreePath,
          });
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
    try {
      await scratchDirRemove({ sessionId });
    } catch {
      console.error(`scratch directory not removed: ${sessionId}`);
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
    await purgeSessionForDelete({ db: tauriDatabase, id: sessionId });
    dropPendingTurnEvents({
      agentIds: (get().sessionPhaseRuns[sessionId] ?? []).map((agent) => agent.id),
    });
    get().evictSession({ sessionId, mode: 'delete' });
    set((state) => {
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
