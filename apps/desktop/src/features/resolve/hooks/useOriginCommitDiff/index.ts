import { useEffect, useState } from 'react';
import { parseUnifiedDiff } from '@goodboy/core';
import type { FileDiff, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';
import { worktreeDiffCommit } from '../../../worktree/worktree';

type Params = {
  readonly sessionId: SessionId;
  readonly sha: string | null;
  readonly path: string | null;
  readonly worktreePath: string | null;
};

export type OriginCommitDiff = Readonly<{
  files: ReadonlyArray<FileDiff>;
  hasFailed: boolean;
}>;

const NO_FILES: ReadonlyArray<FileDiff> = [];

const WAITING: OriginCommitDiff = { files: NO_FILES, hasFailed: false };

const FAILED: OriginCommitDiff = { files: NO_FILES, hasFailed: true };

export const useOriginCommitDiff = ({
  sessionId,
  sha,
  path,
  worktreePath: givenPath,
}: Params): OriginCommitDiff => {
  const [diff, setDiff] = useState<OriginCommitDiff>(WAITING);
  const activePath = useAppStore(
    (state) => resolveSessionRepo({ state, sessionId })?.worktreePath ?? null,
  );
  const worktreePath = givenPath ?? activePath;

  useEffect(() => {
    if (worktreePath === null || sha === null || path === null) {
      setDiff(WAITING);
      return;
    }
    let isCancelled = false;
    worktreeDiffCommit(worktreePath, sha)
      .then((raw) => {
        if (!isCancelled) {
          setDiff({
            files: parseUnifiedDiff(raw).filter((file) => file.path === path),
            hasFailed: false,
          });
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setDiff(FAILED);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [path, sha, worktreePath]);

  return diff;
};
