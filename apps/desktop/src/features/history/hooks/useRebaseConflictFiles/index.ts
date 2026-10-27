import { useEffect, useRef, useState } from 'react';
import { usePoll } from '../../../../shared/lib/usePoll';
import { worktreeRebaseConflicts, type RebaseConflictFile } from '../../../worktree/worktree';

type Params = {
  readonly worktreePath: string | null;
  readonly isRebasing: boolean;
  readonly statusKey: string;
};

type Read = {
  readonly worktreePath: string;
  readonly files: ReadonlyArray<RebaseConflictFile>;
};

const POLL_MS = 4_000;

export const useRebaseConflictFiles = ({
  worktreePath,
  isRebasing,
  statusKey,
}: Params): ReadonlyArray<RebaseConflictFile> | null => {
  const [read, setRead] = useState<Read | null>(null);
  const latest = useRef(0);

  const load = (): void => {
    if (worktreePath === null) {
      return;
    }
    latest.current += 1;
    const token = latest.current;
    void worktreeRebaseConflicts({ worktreePath })
      .then((files) => {
        if (token === latest.current) {
          setRead({ worktreePath, files });
        }
      })
      .catch(() => {
        if (token === latest.current) {
          setRead(null);
        }
      });
  };

  const isPolling = worktreePath !== null && isRebasing;

  useEffect(() => {
    return () => {
      latest.current += 1;
    };
  }, [isPolling, statusKey, worktreePath]);

  usePoll({
    run: load,
    everyMs: POLL_MS,
    isEnabled: isPolling,
    restartKey: `${statusKey}\u0000${worktreePath ?? ''}`,
  });

  if (!isRebasing || read === null || read.worktreePath !== worktreePath) {
    return null;
  }
  return read.files;
};
