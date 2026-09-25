import type {
  Project,
  WorkspaceId,
  WorktreeRemovalMode,
  WorktreeRemovalReason,
  WorktreeRemovalResult,
} from '@goodboy/types';
import { deleteRetainedWorktreePath } from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import { tauriDatabase } from '../../../shared/lib/db';
import { removeWorktreeFolder } from '../../../features/worktree/worktree';
import type { GetFn, SetFn } from './types';

export type OrphanRemoval =
  | { readonly kind: 'removed'; readonly path: string }
  | {
      readonly kind: 'kept';
      readonly path: string;
      readonly reasons: ReadonlyArray<WorktreeRemovalReason>;
    }
  | { readonly kind: 'failed'; readonly path: string; readonly message: string };

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly paths: ReadonlyArray<string>;
  readonly mode: WorktreeRemovalMode;
};

type OwnerParams = {
  readonly projects: ReadonlyArray<Project>;
  readonly path: string;
};

const worktreeOwner = ({ projects, path }: OwnerParams): Project | undefined =>
  projects.find((project) => path.startsWith(`${project.rootPath}/.goodboy/worktrees/`));

type RemovalParams = {
  readonly path: string;
  readonly result: WorktreeRemovalResult;
};

const toRemoval = ({ path, result }: RemovalParams): OrphanRemoval => {
  if (result.kind === 'kept') {
    return { kind: 'kept', path, reasons: result.reasons };
  }
  return { kind: 'removed', path };
};

export const removeOrphanWorktrees = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, paths, mode }: Params): Promise<ReadonlyArray<OrphanRemoval>> => {
    const projects = get().projects.filter(
      (candidate) => candidate.workspaceId === workspaceId && candidate.kind === 'repo',
    );
    if (projects.length === 0) {
      throw new Error(`workspace has no repository project: ${workspaceId}`);
    }
    const retained = get().retainedWorktreePaths[workspaceId] ?? [];
    const outcomes: Array<OrphanRemoval> = [];
    for (const path of paths) {
      const project = worktreeOwner({ projects, path });
      if (project === undefined) {
        outcomes.push({ kind: 'failed', path, message: `no repository owns ${path}` });
        continue;
      }
      try {
        const result = await removeWorktreeFolder({ repoPath: project.rootPath, path, mode });
        outcomes.push(toRemoval({ path, result }));
      } catch (error) {
        outcomes.push({ kind: 'failed', path, message: formatError(error) });
      }
    }
    const removed = new Set(
      outcomes.filter((outcome) => outcome.kind === 'removed').map((outcome) => outcome.path),
    );
    for (const record of retained) {
      if (!removed.has(record.worktreePath)) {
        continue;
      }
      await deleteRetainedWorktreePath({ db: tauriDatabase, id: record.id }).catch(() => undefined);
    }
    set((state) => {
      const next = { ...state.orphanWorktrees };
      next[workspaceId] = (state.orphanWorktrees[workspaceId] ?? []).filter(
        (orphan) => !removed.has(orphan.path),
      );
      return {
        orphanWorktrees: next,
        retainedWorktreePaths: {
          ...state.retainedWorktreePaths,
          [workspaceId]: retained.filter((record) => !removed.has(record.worktreePath)),
        },
      };
    });
    return outcomes;
  };
};
