import type { BranchCommit, WorktreeStatus } from '@goodboy/types';
import { branchPushStateOf, commitsToPush } from '../../shared/lib/branchPushState';

type Params = {
  readonly status: Pick<WorktreeStatus, 'upstreamDistance' | 'mainDistance' | 'upstream'> | null;
  readonly commits: ReadonlyArray<Pick<BranchCommit, 'pushed'>> | null;
  readonly hasRemoteHead: boolean;
};

export const notPushedOf = ({ status, commits, hasRemoteHead }: Params): number | null => {
  const hasUpstream = (status !== null && status.upstream !== null) || hasRemoteHead;
  if (commits !== null && hasUpstream) {
    return commits.filter((commit) => !commit.pushed).length;
  }
  if (status === null) {
    return null;
  }
  if (status.upstreamDistance.kind === 'known') {
    return status.upstreamDistance.ahead;
  }
  return commitsToPush({ state: branchPushStateOf({ status }) });
};
