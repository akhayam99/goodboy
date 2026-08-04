import {
  listArchivedSessionRefs,
  listWorktreesForSessions,
  type SessionWorktree,
} from '@goodboy/db';
import type { Workspace } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { worktreeList } from '../../../features/worktree/worktree';
import { buildSessionMounts } from '../worktrees/buildSessionMounts';
import type { ArchivedWorktreeTarget } from './types';

type Params = {
  readonly workspaces: ReadonlyArray<Workspace>;
};

const isBranchless = (row: SessionWorktree): boolean => row.branch.trim() === '';

const listLiveWorktrees = async (
  repoPaths: ReadonlySet<string>,
): Promise<ReadonlyMap<string, ReadonlySet<string>>> => {
  const live = new Map<string, ReadonlySet<string>>();
  for (const repoPath of repoPaths) {
    try {
      const entries = await worktreeList(repoPath);
      const known = new Set<string>();
      for (const entry of entries) {
        if (entry.isMain) {
          continue;
        }
        known.add(entry.path);
        if (entry.branch != null) {
          known.add(entry.branch);
        }
      }
      live.set(repoPath, known);
    } catch {
      live.set(repoPath, new Set());
    }
  }
  return live;
};

export const collectArchivedWorktrees = async ({
  workspaces,
}: Params): Promise<ReadonlyArray<ArchivedWorktreeTarget>> => {
  const refs = await listArchivedSessionRefs({ db: tauriDatabase });
  if (refs.length === 0) {
    return [];
  }
  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  const rowsBySession = await listWorktreesForSessions(
    tauriDatabase,
    refs.map((ref) => ref.sessionId),
  );

  const candidates: ArchivedWorktreeTarget[] = [];
  const branchByPath = new Map<string, string>();
  for (const ref of refs) {
    const workspace = workspaceById.get(ref.workspaceId);
    if (workspace == null || workspace.kind === 'simple') {
      continue;
    }
    const rows = rowsBySession.get(ref.sessionId) ?? [];
    if (workspace.kind === 'composite') {
      for (const mount of buildSessionMounts({ workspace, rows })) {
        if (mount.branch.trim() === '') {
          continue;
        }
        candidates.push({
          sessionId: ref.sessionId,
          repoPath: mount.repoRoot,
          worktreePath: mount.worktreePath,
        });
        branchByPath.set(mount.worktreePath, mount.branch);
      }
      continue;
    }
    for (const row of rows) {
      if (isBranchless(row)) {
        continue;
      }
      candidates.push({
        sessionId: ref.sessionId,
        repoPath: workspace.rootPath,
        worktreePath: row.worktreePath,
      });
      branchByPath.set(row.worktreePath, row.branch);
    }
  }

  const live = await listLiveWorktrees(new Set(candidates.map((target) => target.repoPath)));
  return candidates.filter((target) => {
    const known = live.get(target.repoPath);
    if (known == null) {
      return false;
    }
    const branch = branchByPath.get(target.worktreePath);
    return known.has(target.worktreePath) || (branch != null && known.has(branch));
  });
};
