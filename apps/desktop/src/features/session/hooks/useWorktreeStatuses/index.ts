import { useEffect, useState } from 'react';
import type { WorktreeStatus } from '@goodboy/types';
import { worktreeStatus } from '../../../worktree/worktree';

type Params = {
  readonly worktreePaths: ReadonlyArray<string>;
};

type StatusEntry = readonly [string, WorktreeStatus];

const REFRESH_MS = 30_000;

export const useWorktreeStatuses = ({
  worktreePaths,
}: Params): ReadonlyMap<string, WorktreeStatus> => {
  const [statuses, setStatuses] = useState<ReadonlyMap<string, WorktreeStatus>>(new Map());

  useEffect(() => {
    let isStale = false;
    const refresh = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      void Promise.all(
        worktreePaths.map(async (worktreePath) => {
          try {
            const status = await worktreeStatus(worktreePath);
            const entry: StatusEntry = [worktreePath, status];
            return entry;
          } catch {
            return null;
          }
        }),
      ).then((entries) => {
        if (!isStale) {
          setStatuses(new Map(entries.filter((entry) => entry !== null)));
        }
      });
    };
    setStatuses(new Map());
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      isStale = true;
      clearInterval(timer);
    };
  }, [worktreePaths]);

  return statuses;
};
