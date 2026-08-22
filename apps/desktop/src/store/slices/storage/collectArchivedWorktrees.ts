import {
  listArchivedSessionRefs,
  listWorktreesForSessions,
  type SessionWorktree,
} from '@goodboy/db';
import type { Project } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { worktreeList } from '../../../features/worktree/worktree';
import type { ArchivedWorktreeTarget } from './types';

type Params = {
  readonly projects: ReadonlyArray<Project>;
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
  projects,
}: Params): Promise<ReadonlyArray<ArchivedWorktreeTarget>> => {
  const refs = await listArchivedSessionRefs({ db: tauriDatabase });
  if (refs.length === 0) {
    return [];
  }
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const rowsBySession = await listWorktreesForSessions(
    tauriDatabase,
    refs.map((ref) => ref.sessionId),
  );

  const candidates: ArchivedWorktreeTarget[] = [];
  const branchByPath = new Map<string, string>();
  for (const ref of refs) {
    const rows = rowsBySession.get(ref.sessionId) ?? [];
    for (const row of rows) {
      const project = row.projectId === undefined ? undefined : projectById.get(row.projectId);
      if (isBranchless(row) || project?.kind !== 'repo') {
        continue;
      }
      candidates.push({
        sessionId: ref.sessionId,
        repoPath: project.rootPath,
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
