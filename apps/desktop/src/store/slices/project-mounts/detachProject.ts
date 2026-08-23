import type { ProjectId, SessionId, SessionProjectMount } from '@goodboy/types';
import { deleteSessionWorktreeForProject, updateSessionActiveProject } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import { tauriDatabase } from '../../../shared/lib/db';
import {
  removeSessionDirectory,
  removeWorktree,
  worktreeStatus,
} from '../../../features/worktree/worktree';
import type { GetFn, SetFn } from './types';

export type DetachProjectInput = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
};

type MountParams = {
  readonly mount: SessionProjectMount;
};

const hasUncommittedWork = async ({ mount }: MountParams): Promise<boolean> => {
  try {
    const status = await worktreeStatus(mount.worktreePath);
    if (status.workingTree.kind !== 'known') {
      return true;
    }
    const { staged, unstaged, untracked, unmerged } = status.workingTree;
    return staged + unstaged + untracked + unmerged > 0;
  } catch {
    return true;
  }
};

export const detachProject = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, projectId }: DetachProjectInput): Promise<void> => {
    const mounts = get().sessionProjectMounts[sessionId] ?? [];
    const mount = mounts.find((candidate) => candidate.projectId === projectId);
    if (mount === undefined) {
      throw new Error(`project not mounted in this session: ${projectId}`);
    }
    const project = get().projects.find((candidate) => candidate.id === projectId);
    const projectName = project?.name ?? mount.mountName;
    let kept = true;
    let keptReason: string | null = null;
    if (project?.kind !== 'repo') {
      keptReason = 'folder projects keep their directory';
    } else {
      const dirty = await hasUncommittedWork({ mount });
      if (dirty) {
        keptReason = 'uncommitted changes in the worktree';
      } else {
        try {
          await removeWorktree(mount.repoRoot, mount.worktreePath);
          kept = false;
        } catch (error) {
          keptReason = formatError(error);
        }
      }
    }
    await deleteSessionWorktreeForProject({ db: tauriDatabase, sessionId, projectId });
    const remaining = mounts.filter((candidate) => candidate.projectId !== projectId);
    const activeId = get().sessionActiveProject[sessionId] ?? null;
    const nextActiveId =
      activeId === projectId ? (remaining[0]?.projectId ?? null) : (activeId ?? null);
    if (activeId === projectId) {
      await updateSessionActiveProject({
        db: tauriDatabase,
        id: sessionId,
        projectId: nextActiveId,
      }).catch(() => undefined);
    }
    await get().recordSessionEvent({
      sessionId,
      kind: 'project_detached',
      payload: {
        projectId,
        projectName,
        branch: mount.branch,
        worktreePath: mount.worktreePath,
        kept,
        ...(keptReason != null ? { reason: keptReason } : {}),
      },
    });
    set((state) => {
      const worktreeRecords = state.sessionWorktreeRecords?.[sessionId];
      return {
        sessionProjectMounts: {
          ...state.sessionProjectMounts,
          [sessionId]: remaining,
        },
        sessionWorktrees: {
          ...state.sessionWorktrees,
          [sessionId]: (state.sessionWorktrees[sessionId] ?? []).filter(
            (path) => path !== mount.worktreePath,
          ),
        },
        ...(worktreeRecords !== undefined
          ? {
              sessionWorktreeRecords: {
                ...state.sessionWorktreeRecords,
                [sessionId]: worktreeRecords.filter((record) => record.projectId !== projectId),
              },
            }
          : {}),
        ...(activeId === projectId
          ? {
              sessionActiveProject: Object.fromEntries(
                Object.entries(state.sessionActiveProject)
                  .filter(([key]) => key !== sessionId)
                  .concat(nextActiveId === null ? [] : [[sessionId, nextActiveId]]),
              ),
              sessions: state.sessions.map((candidate) => {
                if (candidate.id !== sessionId) {
                  return candidate;
                }
                if (nextActiveId === null) {
                  const { activeProjectId, ...rest } = candidate;
                  return rest;
                }
                return { ...candidate, activeProjectId: nextActiveId };
              }),
            }
          : {}),
      };
    });
  };
};
