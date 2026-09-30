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
  readonly fallbackWorktreePath: string | null;
};

const NO_FILES: ReadonlyArray<FileDiff> = [];

export const useOriginCommitDiff = ({
  sessionId,
  sha,
  path,
  fallbackWorktreePath,
}: Params): ReadonlyArray<FileDiff> => {
  const [files, setFiles] = useState<ReadonlyArray<FileDiff>>(NO_FILES);
  const repoPath = useAppStore(
    (state) => resolveSessionRepo({ state, sessionId })?.worktreePath ?? null,
  );
  const worktreePath = repoPath ?? fallbackWorktreePath;

  useEffect(() => {
    if (worktreePath === null || sha === null || path === null) {
      setFiles(NO_FILES);
      return;
    }
    let isCancelled = false;
    worktreeDiffCommit(worktreePath, sha)
      .then((raw) => {
        if (!isCancelled) {
          setFiles(parseUnifiedDiff(raw).filter((file) => file.path === path));
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setFiles(NO_FILES);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [path, sha, worktreePath]);

  return files;
};
