import {
  insertSessionWorktree,
  updateSessionWorktreeRepoSlug,
  type SessionWorktree,
} from '@goodboy/db';
import { detectRepoSlug } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { MountId, Project, Session, SessionId, SessionProjectMount } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { tauriGhRunner } from '../../../features/github/github';
import { createSessionDir, createWorktree } from '../../../features/worktree/worktree';
import { consumeAdoptionSeed, materializationSeedFor } from '../sessions/materializationSeeds';
import { mountPlan } from '../sessions/mountPlan';
import { branchInUseError } from './mountErrors';
import { mountDirName } from './mountDirName';
import { mountViewPatch } from './mountViewPatch';
import { withRepositoryAndMountLock } from './mountLocks';
import type { GetFn, SetFn } from './types';

type StampRepoSlugParams = {
  readonly sessionId: SessionId;
  readonly workspaceId: string;
  readonly repoRoot: string;
  readonly worktreePath: string;
  readonly projectId: Project['id'];
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

type AppendRecordParams = {
  readonly current: Readonly<Record<string, ReadonlyArray<SessionWorktree>>> | undefined;
  readonly sessionId: SessionId;
  readonly record: SessionWorktree;
};

export const withWorktreeRecord = ({
  current,
  sessionId,
  record,
}: AppendRecordParams): Readonly<Record<string, ReadonlyArray<SessionWorktree>>> => {
  const rows = current?.[sessionId] ?? [];
  if (rows.some((row) => row.id === record.id)) {
    return current ?? {};
  }
  return { ...current, [sessionId]: [...rows, record] };
};

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly session: Session;
  readonly project: Project;
  readonly mountId: MountId;
  readonly requestId: string;
  readonly reason: string;
  readonly parallelIndex: number;
  readonly taskIdentifiers?: ReadonlyArray<string>;
  readonly slug?: string;
};

export const createProjectMount = async ({
  set,
  get,
  session,
  project,
  mountId,
  requestId,
  reason,
  parallelIndex,
  taskIdentifiers,
  slug: plannedSlug,
}: Params): Promise<SessionProjectMount> =>
  withRepositoryAndMountLock({
    repoRoot: project.rootPath,
    mountKey: `${session.id}:${requestId}`,
    run: async () => {
      const sessionId = session.id;
      const projectId = project.id;
      const plan = mountPlan({
        state: get(),
        sessionId,
        projectId,
        mountId,
        ...(taskIdentifiers === undefined ? {} : { taskIdentifiers }),
      });
      if (plan === null) {
        throw new Error(`project not found in this workspace: ${projectId}`);
      }
      const seed = materializationSeedFor({ sessionId });
      const hasRepoMount = (get().sessionProjectMounts[sessionId] ?? []).some(
        (mount) => mount.branch !== '',
      );
      const adoptedBranch = hasRepoMount ? undefined : seed?.existingBranch;
      const adoptedFallbackRef = adoptedBranch === undefined ? undefined : seed?.fallbackRef;
      const sessionSlug = plannedSlug ?? plan.slug;
      let created;
      try {
        created =
          project.kind === 'repo'
            ? await createWorktree({
                repoPath: project.rootPath,
                branchPrefix: plan.prefix,
                slug: sessionSlug,
                parentDir: `${project.rootPath}/.goodboy/worktrees`,
                dirName: mountDirName({ sessionSlug, mountId }),
                baseBranch: project.baseBranch ?? undefined,
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
          payload: { projectId, projectName: project.name, reason: formatError(error) },
        });
        const branchInUse = branchInUseError({ error });
        if (branchInUse !== null) {
          throw branchInUse;
        }
        throw error;
      }
      if (adoptedBranch !== undefined) {
        consumeAdoptionSeed({ sessionId });
      }
      const record: SessionWorktree = {
        id: mountId,
        sessionId,
        worktreePath: created.worktreePath,
        branch: created.branchName,
        parallelIndex,
        projectId,
        mountName: project.name,
        revision: 0,
        createdAt: Date.now(),
      };
      await insertSessionWorktree(tauriDatabase, record);
      await get().recordSessionEvent({
        sessionId,
        kind: 'project_materialized',
        payload: {
          projectId,
          projectName: project.name,
          branch: created.branchName,
          reason,
        },
      });
      const mount: SessionProjectMount = {
        mountId,
        sessionId,
        projectId,
        mountName: project.name,
        worktreePath: created.worktreePath,
        lastWorktreePath: created.worktreePath,
        repoRoot: project.rootPath,
        branch: created.branchName,
        baseBranch: project.baseBranch ?? null,
        parallelIndex,
        isAttached: true,
        diskState: 'present',
        revision: 0,
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
        sessionWorktreeRecords: withWorktreeRecord({
          current: state.sessionWorktreeRecords,
          sessionId,
          record,
        }),
        ...mountViewPatch({ state, sessionId, mount }),
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
    },
  });
