import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Tooltip } from '@goodboy/ui';
import type { GitDistance, SessionId } from '@goodboy/types';
import { worktreeStatus } from '../../../worktree/worktree';
import { useActiveMount } from '../../hooks/useActiveMount';

type Props = {
  readonly sessionId: SessionId;
};

const REFRESH_MS = 30_000;

type SyncLabelParams = {
  readonly ahead: number;
  readonly behind: number;
};

const syncLabel = ({ ahead, behind }: SyncLabelParams): string => {
  if (ahead === 0 && behind === 0) {
    return 'In sync with main';
  }
  if (ahead === 0) {
    return `${behind} ${behind === 1 ? 'commit' : 'commits'} behind main`;
  }
  const aheadPart = `${ahead} ${ahead === 1 ? 'commit' : 'commits'} ahead of main`;
  if (behind === 0) {
    return aheadPart;
  }
  return `${aheadPart}, ${behind} behind`;
};

export const BranchSyncStatus = ({ sessionId }: Props) => {
  const activeMount = useActiveMount({ sessionId });
  const worktreePath = activeMount?.worktreePath ?? null;
  const [distance, setDistance] = useState<GitDistance | null>(null);

  useEffect(() => {
    if (worktreePath == null) {
      return;
    }
    let isStale = false;
    const refresh = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      void worktreeStatus(worktreePath)
        .then((next) => {
          if (!isStale) {
            setDistance(next.mainDistance);
          }
        })
        .catch(() => {
          if (!isStale) {
            setDistance(null);
          }
        });
    };
    setDistance(null);
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      isStale = true;
      clearInterval(timer);
    };
  }, [worktreePath]);

  if (worktreePath == null || distance == null || distance.kind !== 'known') {
    return null;
  }

  return (
    <Tooltip content={syncLabel({ ahead: distance.ahead, behind: distance.behind })}>
      <span
        data-testid="branch-sync-status"
        aria-label={syncLabel({ ahead: distance.ahead, behind: distance.behind })}
        className="flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 font-mono text-2xs tabular-nums text-muted-foreground"
      >
        <ArrowDown size={10} aria-hidden />
        {distance.behind}
        <ArrowUp size={10} aria-hidden />
        {distance.ahead}
      </span>
    </Tooltip>
  );
};
