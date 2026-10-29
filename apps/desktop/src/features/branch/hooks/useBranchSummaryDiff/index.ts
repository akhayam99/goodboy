import { useCallback, useEffect, useState } from 'react';
import { formatError } from '@goodboy/ui';
import { parseUnifiedDiff } from '@goodboy/core';
import type { FileDiff, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectMountBaseBranch } from '../../../../store/slices/project-mounts/selectors';
import { worktreeDiff } from '../../../worktree/worktree';

type Params = {
  readonly sessionId: SessionId;
  readonly worktreePath: string | null;
  readonly revision: number | string;
};

export type BranchSummaryDiff = Readonly<{
  files: ReadonlyArray<FileDiff>;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}>;

export const useBranchSummaryDiff = ({
  sessionId,
  worktreePath,
  revision,
}: Params): BranchSummaryDiff => {
  const [files, setFiles] = useState<ReadonlyArray<FileDiff>>([]);
  const [isLoading, setIsLoading] = useState(worktreePath !== null);
  const [error, setError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const baseBranch = useAppStore((state) =>
    selectMountBaseBranch({ state, sessionId, path: worktreePath }),
  );
  const retry = useCallback(() => setRetryTick((tick) => tick + 1), []);

  useEffect(() => {
    if (worktreePath === null) {
      setFiles([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    let isCurrent = true;
    setIsLoading(true);
    setError(null);
    worktreeDiff({ worktreePath, baseBranch })
      .then((raw) => {
        if (!isCurrent) {
          return;
        }
        setFiles(parseUnifiedDiff(raw));
        setIsLoading(false);
      })
      .catch((failure: unknown) => {
        if (!isCurrent) {
          return;
        }
        setError(formatError(failure));
        setIsLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [worktreePath, baseBranch, revision, retryTick]);

  return { files, isLoading, error, retry };
};
