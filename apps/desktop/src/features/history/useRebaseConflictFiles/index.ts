import { useEffect, useRef, useState } from 'react';
import { worktreeRebaseConflicts, type RebaseConflictFile } from '../../worktree/worktree';

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

  useEffect(() => {
    if (worktreePath === null || !isRebasing) {
      latest.current += 1;
      return undefined;
    }
    const load = (): void => {
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
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => {
      latest.current += 1;
      window.clearInterval(timer);
    };
  }, [isRebasing, statusKey, worktreePath]);

  if (!isRebasing || read === null || read.worktreePath !== worktreePath) {
    return null;
  }
  return read.files;
};
