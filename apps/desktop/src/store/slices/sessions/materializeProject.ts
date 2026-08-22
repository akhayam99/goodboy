import type { ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';
import {
  insertSessionWorktree,
  listWorktreesForSession,
  updateSessionActiveProject,
  updateSessionWorktreeBranch,
  updateSessionWorktreeRepoSlug,
} from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import { detectRepoSlug } from '@goodboy/core';
import { tauriDatabase } from '../../../shared/lib/db';
import { tauriGhRunner } from '../../../features/github/github';
import { createSessionDir, createWorktree } from '../../../features/worktree/worktree';
import { DEFAULT_BRANCH_PREFIX } from '../../../features/settings/settings';
import { consumeAdoptionSeed, materializationSeedFor } from './materializationSeeds';
import type { GetFn, SetFn } from './types';

export type MaterializeProjectInput = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly reason: string;
};

type StampRepoSlugParams = {
  readonly sessionId: SessionId;
  readonly workspaceId: string;
  readonly repoRoot: string;
  readonly worktreePath: string;
  readonly projectId: ProjectId;
};

const stampRepoSlug = async ({
  sessionId,
  workspaceId,
  repoRoot,
  worktreePath,
  projectId,
}: StampRepoSlugParams): Promise<void> => {
  try {
    const slug = await detectRepoSlug(tauriGhRunner, repoRoot, workspaceId, projectId);
    if (slug == null) {
      return;
    }
    await updateSessionWorktreeRepoSlug({
      db: tauriDatabase,
      sessionId,
      worktreePath,
      repoSlug: slug,
    });
  } catch {
    return;
  }
};

const inFlight = new Map<string, Promise<SessionProjectMount>>();

export const materializeProject = (set: SetFn, get: GetFn) => {
  const run = async ({
    sessionId,
    projectId,
    reason,
  }: MaterializeProjectInput): Promise<SessionProjectMount> => {
    const trimmedReason = reason.trim();
    if (trimmedReason === '') {
      throw new Error('materializing a project requires a reason');
    }
    const session =
      get().sessions.find((candidate) => candidate.id === sessionId) ??
      Object.values(get().archivedSessions)
        .flat()
        .find((candidate) => candidate.id === sessionId);
    if (session === undefined) {
      throw new Error(`session not found: ${sessionId}`);
    }
    const existingMount = (get().sessionProjectMounts[sessionId] ?? []).find(
      (mount) => mount.projectId === projectId,
    );
    if (existingMount !== undefined) {
      return existingMount;
    }
    const project = get().projects.find((candidate) => candidate.id === projectId);
    if (project === undefined || project.workspaceId !== session.workspaceId) {
      throw new Error(`project not found in this workspace: ${projectId}`);
    }
    const containerDir = (get().sessionWorktrees[sessionId] ?? [])[0] ?? null;
    if (containerDir === null) {
      throw new Error('session container not initialized. restart the app to reload it');
    }
    const rows = await listWorktreesForSession(tauriDatabase, sessionId);
    const persistedRow = rows.find((row) => row.projectId === projectId);
    if (persistedRow !== undefined) {
      const persistedMount: SessionProjectMount = {
        projectId,
        mountName: persistedRow.mountName ?? project.name,
        worktreePath: persistedRow.worktreePath,
        repoRoot: project.rootPath,
        branch: persistedRow.branch,
      };
      set((state) => ({
        sessionProjectMounts: {
          ...state.sessionProjectMounts,
          [sessionId]: [...(state.sessionProjectMounts[sessionId] ?? []), persistedMount],
        },
      }));
      return persistedMount;
    }
    const seed = materializationSeedFor({ sessionId });
    const sessionSlug = seed?.sessionSlug ?? containerDir.split('/').pop() ?? sessionId.slice(0, 8);
    const prefix = seed?.branchPrefix ?? DEFAULT_BRANCH_PREFIX;
    const hasRepoMount = rows.some((row) => row.projectId !== undefined && row.branch !== '');
    const adoptedBranch = hasRepoMount ? undefined : seed?.existingBranch;
    const adoptedFallbackRef = adoptedBranch === undefined ? undefined : seed?.fallbackRef;
    let created;
    try {
      created =
        project.kind === 'repo'
          ? await createWorktree({
              repoPath: project.rootPath,
              branchPrefix: prefix,
              slug: sessionSlug,
              parentDir: containerDir,
              dirName: project.name,
              ...(adoptedBranch !== undefined ? { existingBranch: adoptedBranch } : {}),
              ...(adoptedFallbackRef !== undefined ? { fallbackRef: adoptedFallbackRef } : {}),
            })
          : await createSessionDir({
              basePath: project.rootPath,
              slug: sessionSlug,
              ...(seed?.folderName !== undefined ? { directoryName: seed.folderName } : {}),
              sessionId,
              workspaceId: session.workspaceId,
            });
    } catch (error) {
      await get().recordSessionEvent({
        sessionId,
        kind: 'project_materialization_refused',
        payload: { projectId, reason: formatError(error) },
      });
      throw error;
    }
    if (adoptedBranch !== undefined) {
      consumeAdoptionSeed({ sessionId });
    }
    const nextParallelIndex = rows.reduce((max, row) => Math.max(max, row.parallelIndex), 0) + 1;
    await insertSessionWorktree(tauriDatabase, {
      id: crypto.randomUUID(),
      sessionId,
      worktreePath: created.worktreePath,
      branch: created.branchName,
      parallelIndex: nextParallelIndex,
      projectId,
      mountName: project.name,
      createdAt: Date.now(),
    });
    const seedsContainerBranch =
      created.branchName !== '' && rows.every((row) => row.branch === '');
    if (seedsContainerBranch) {
      await updateSessionWorktreeBranch(tauriDatabase, sessionId, 0, created.branchName);
    }
    const isFirstActiveProject =
      session.activeProjectId === undefined && get().sessionActiveProject[sessionId] === undefined;
    if (isFirstActiveProject) {
      await updateSessionActiveProject({ db: tauriDatabase, id: sessionId, projectId }).catch(
        () => undefined,
      );
    }
    await get().recordSessionEvent({
      sessionId,
      kind: 'project_materialized',
      payload: { projectId, branch: created.branchName, reason: trimmedReason },
    });
    const mount: SessionProjectMount = {
      projectId,
      mountName: project.name,
      worktreePath: created.worktreePath,
      repoRoot: project.rootPath,
      branch: created.branchName,
    };
    set((state) => ({
      sessionProjectMounts: {
        ...state.sessionProjectMounts,
        [sessionId]: [...(state.sessionProjectMounts[sessionId] ?? []), mount],
      },
      sessionWorktrees: {
        ...state.sessionWorktrees,
        [sessionId]: [...(state.sessionWorktrees[sessionId] ?? []), created.worktreePath],
      },
      ...(seedsContainerBranch
        ? { sessionBranches: { ...state.sessionBranches, [sessionId]: created.branchName } }
        : {}),
      ...(isFirstActiveProject
        ? {
            sessionActiveProject: { ...state.sessionActiveProject, [sessionId]: projectId },
            sessions: state.sessions.map((candidate) =>
              candidate.id === sessionId ? { ...candidate, activeProjectId: projectId } : candidate,
            ),
          }
        : {}),
    }));
    if (project.kind === 'repo') {
      void stampRepoSlug({
        sessionId,
        workspaceId: session.workspaceId,
        repoRoot: project.rootPath,
        worktreePath: created.worktreePath,
        projectId,
      });
    }
    return mount;
  };
  return async (input: MaterializeProjectInput): Promise<SessionProjectMount> => {
    const key = `${input.sessionId}:${input.projectId}`;
    const pending = inFlight.get(key);
    if (pending !== undefined) {
      return pending;
    }
    const promise = run(input).finally(() => {
      inFlight.delete(key);
    });
    inFlight.set(key, promise);
    return promise;
  };
};
