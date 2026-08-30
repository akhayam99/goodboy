import { useEffect, useState } from 'react';
import type { WorktreeStatus } from '@goodboy/types';
import { worktreeStatus } from '../../../worktree/worktree';

type Params = {
  readonly targets: ReadonlyArray<{
    readonly worktreePath: string;
    readonly baseBranch?: string;
  }>;
};

type StatusEntry = readonly [string, WorktreeStatus];

const REFRESH_MS = 30_000;
const EMPTY_STATUSES: ReadonlyMap<string, WorktreeStatus> = new Map();

export const useWorktreeStatuses = ({ targets }: Params): ReadonlyMap<string, WorktreeStatus> => {
  const [statuses, setStatuses] = useState<ReadonlyMap<string, WorktreeStatus>>(EMPTY_STATUSES);

  useEffect(() => {
    if (targets.length === 0) {
      setStatuses(EMPTY_STATUSES);
      return;
    }
    let isStale = false;
    const refresh = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      void Promise.all(
        targets.map(async ({ worktreePath, baseBranch }) => {
          try {
            const status = await worktreeStatus({ worktreePath, baseBranch });
            const entry: StatusEntry = [worktreePath, status];
            return entry;
          } catch {
            return null;
          }
        }),
      ).then((entries) => {
        if (!isStale) {
          setStatuses(new Map(entries.filter((entry): entry is StatusEntry => entry !== null)));
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
  }, [targets]);

  return statuses;
};
