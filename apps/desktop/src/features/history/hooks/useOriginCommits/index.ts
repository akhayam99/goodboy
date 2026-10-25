import { useEffect, useRef, useState } from 'react';
import type { HistoryRebaseCommit, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { historyTargetOf } from '../../../../store/slices/history/historyTargetOf';
import { readOriginAhead } from '../../historyEngine';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly since: string | null;
  readonly isWanted: boolean;
};

type Read = {
  readonly key: string;
  readonly commits: ReadonlyArray<HistoryRebaseCommit>;
};

export const useOriginCommits = ({
  sessionId,
  mountId,
  since,
  isWanted,
}: Params): ReadonlyArray<HistoryRebaseCommit> | null => {
  const [read, setRead] = useState<Read | null>(null);
  const latest = useRef(0);
  const key = `${sessionId}:${mountId ?? ''}:${since ?? ''}`;

  useEffect(() => {
    latest.current += 1;
    if (!isWanted || mountId === null) {
      return undefined;
    }
    const token = latest.current;
    const load = async (): Promise<ReadonlyArray<HistoryRebaseCommit>> => {
      const target = historyTargetOf({ get: useAppStore.getState, sessionId, mountId });
      const ahead = await readOriginAhead({
        worktreePath: target.worktreePath,
        branch: target.branch,
        since,
        isBringingIn: false,
        workspaceId: target.workspaceId,
        projectId: target.projectId,
      });
      return ahead.commits;
    };
    void load()
      .then((commits) => {
        if (token === latest.current) {
          setRead({ key, commits });
        }
      })
      .catch(() => {
        if (token === latest.current) {
          setRead(null);
        }
      });
    return () => {
      latest.current += 1;
    };
  }, [isWanted, key, mountId, sessionId, since]);

  if (!isWanted || read === null || read.key !== key) {
    return null;
  }
  return read.commits;
};
