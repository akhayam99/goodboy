import type { WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { removeOrphanWorktree } from '../../../features/worktree/worktree';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly paths: ReadonlyArray<string>;
};

export const removeOrphanWorktrees = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, paths }: Params): Promise<void> => {
    const project = get().projects.find(
      (candidate) => candidate.workspaceId === workspaceId && candidate.kind === 'repo',
    );
    if (project === undefined) {
      throw new Error(`workspace has no repository project: ${workspaceId}`);
    }
    const failures: Array<string> = [];
    const removed = new Set<string>();
    for (const path of paths) {
      try {
        await removeOrphanWorktree({ repoPath: project.rootPath, path });
        removed.add(path);
      } catch (error) {
        failures.push(formatError(error));
      }
    }
    set((state) => {
      const next = { ...state.orphanWorktrees };
      next[workspaceId] = (state.orphanWorktrees[workspaceId] ?? []).filter(
        (orphan) => !removed.has(orphan.path),
      );
      return { orphanWorktrees: next };
    });
    if (failures.length > 0) {
      throw new Error(failures.join('\n'));
    }
  };
};
