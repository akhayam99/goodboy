import { useEffect, useState } from 'react';
import type { WorktreeStatus } from '@goodboy/types';
import type { MountRowView } from '../../../../../../store/slices/project-mounts/mountRowModel';
import { remoteBranchState, type RemoteBranchState } from '../../../../../worktree/worktree';
import { isForeignCommitCandidate } from '../foreignCommits';

type Params = {
  readonly row: MountRowView;
  readonly status: WorktreeStatus | null;
};

type Found = {
  readonly key: string;
  readonly state: RemoteBranchState;
};

export const useForeignCommits = ({ row, status }: Params): RemoteBranchState | null => {
  const [found, setFound] = useState<Found | null>(null);
  const isCandidate = isForeignCommitCandidate({ row, status });
  const key = `${row.mountId}:${row.branch}:${status?.head ?? ''}`;

  useEffect(() => {
    if (!isCandidate) {
      setFound(null);
      return;
    }
    let isStale = false;
    remoteBranchState({ repoPath: row.repoRoot, branch: row.branch, base: row.baseBranch })
      .then((state) => {
        if (isStale) {
          return;
        }
        const isStranded =
          state !== null &&
          state.remoteAhead > 0 &&
          state.localOwn === 0 &&
          state.remoteContainsLocal;
        setFound(isStranded ? { key, state } : null);
      })
      .catch(() => {
        if (!isStale) {
          setFound(null);
        }
      });
    return () => {
      isStale = true;
    };
  }, [isCandidate, key, row.repoRoot, row.branch, row.baseBranch]);

  return isCandidate && found !== null && found.key === key ? found.state : null;
};
