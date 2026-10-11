import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { WorktreeStatus } from '@goodboy/types';
import {
  ensure,
  readWorktreeStatus,
  subscribe,
  worktreeStatusKey,
} from '../../../store/slices/worktreeStatuses/cache';

type Params = {
  readonly worktreePath: string | null;
  readonly baseBranch: string | null;
};

const MAX_AGE_MS = 10_000;

const noop = (): void => undefined;

export const useWorktreeTree = ({ worktreePath, baseBranch }: Params): WorktreeStatus | null => {
  const key =
    worktreePath === null
      ? null
      : worktreeStatusKey({ worktreePath, baseBranch: baseBranch ?? undefined });

  useEffect(() => {
    if (key === null || worktreePath === null) {
      return;
    }
    void ensure({
      key,
      worktreePath,
      baseBranch: baseBranch ?? undefined,
      maxAgeMs: MAX_AGE_MS,
    });
  }, [baseBranch, key, worktreePath]);

  const watch = useCallback(
    (listener: () => void) => (key === null ? noop : subscribe({ key, listener })),
    [key],
  );
  return useSyncExternalStore(watch, () => (key === null ? null : readWorktreeStatus(key)));
};
