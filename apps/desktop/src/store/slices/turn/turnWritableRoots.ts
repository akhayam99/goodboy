import type { SessionProjectMount } from '@goodboy/types';
import { gitCommonDirectory, worktreeGitDirectory } from '../../../features/worktree/worktree';

type MountsParams = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

type WorktreePathsParams = {
  readonly worktreePaths: ReadonlyArray<string>;
};

type BuildParams = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
  readonly workingDir: string;
  readonly gitDirs: ReadonlyMap<string, string>;
  readonly worktreeGitDirs: ReadonlyMap<string, string>;
};

export const isTurnWritableMount = (mount: SessionProjectMount): boolean =>
  mount.branch !== '' && mount.isAttached !== false && mount.worktreePath !== '';

export const repoRootsForTurn = ({
  mounts,
}: {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
}): ReadonlyArray<string> =>
  Array.from(new Set(mounts.filter(isTurnWritableMount).map((mount) => mount.repoRoot)));

export const worktreePathsForTurn = ({ mounts }: MountsParams): ReadonlyArray<string> =>
  Array.from(new Set(mounts.filter(isTurnWritableMount).map((mount) => mount.worktreePath)));

export const buildTurnWritableRoots = ({
  mounts,
  workingDir,
  gitDirs,
  worktreeGitDirs,
}: BuildParams): ReadonlyArray<string> => {
  const writable = mounts.filter(isTurnWritableMount);
  const siblings = writable
    .filter((mount) => mount.worktreePath !== workingDir)
    .map((mount) => mount.worktreePath);
  const metadata = writable.map((mount) => gitDirs.get(mount.repoRoot) ?? `${mount.repoRoot}/.git`);
  const ownMetadata = writable.flatMap((mount) => {
    const found = worktreeGitDirs.get(mount.worktreePath);
    return found === undefined ? [] : [found];
  });
  return Array.from(new Set([...siblings, ...metadata, ...ownMetadata]));
};

export const resolveGitCommonDirs = async ({
  repoRoots,
}: {
  readonly repoRoots: ReadonlyArray<string>;
}): Promise<ReadonlyMap<string, string>> => {
  const resolved = new Map<string, string>();
  for (const repoRoot of repoRoots) {
    try {
      const found = await gitCommonDirectory({ repoPath: repoRoot });
      if (found !== null && found !== '') {
        resolved.set(repoRoot, found);
      }
    } catch {
      continue;
    }
  }
  return resolved;
};

export const resolveWorktreeGitDirs = async ({
  worktreePaths,
}: WorktreePathsParams): Promise<ReadonlyMap<string, string>> => {
  const resolved = new Map<string, string>();
  for (const worktreePath of worktreePaths) {
    try {
      const found = await worktreeGitDirectory({ worktreePath });
      if (found !== null && found !== '') {
        resolved.set(worktreePath, found);
      }
    } catch {
      continue;
    }
  }
  return resolved;
};
