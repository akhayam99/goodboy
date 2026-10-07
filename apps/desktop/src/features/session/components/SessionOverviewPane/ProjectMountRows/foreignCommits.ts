import type { WorktreeStatus } from '@goodboy/types';
import type { MountRowView } from '../../../../../store/slices/project-mounts/mountRowModel';
import { isOpenRequest } from '../../../../../store/slices/project-mounts/mountRowModel';

type CandidateParams = {
  readonly row: MountRowView;
  readonly status: WorktreeStatus | null;
};

const tracksOwnBranchBehind = ({ status }: { readonly status: WorktreeStatus }): boolean => {
  if (status.branch === null || status.upstream === null) {
    return false;
  }
  const slash = status.upstream.indexOf('/');
  if (slash < 0 || status.upstream.slice(slash + 1) !== status.branch) {
    return false;
  }
  return status.upstreamDistance.kind === 'known' && status.upstreamDistance.behind > 0;
};

export const isForeignCommitCandidate = ({ row, status }: CandidateParams): boolean => {
  if (row.projectKind !== 'repo' || !row.isAttached || row.worktreePath === null) {
    return false;
  }
  if (row.branch === '' || row.isMainCheckout || status === null) {
    return false;
  }
  if (status.inProgress !== null || status.branch !== row.branch) {
    return false;
  }
  if (status.mainDistance.kind !== 'known' || status.mainDistance.ahead > 0) {
    return false;
  }
  return isOpenRequest({ request: row.request }) || tracksOwnBranchBehind({ status });
};

export const isWorktreeClean = ({ status }: { readonly status: WorktreeStatus }): boolean =>
  status.workingTree.kind === 'known' && status.workingTree.changed === 0;

type BodyParams = {
  readonly branch: string;
  readonly remoteAhead: number;
  readonly isClean: boolean;
};

export const foreignCommitsBody = ({ branch, remoteAhead, isClean }: BodyParams): string => {
  const noun = remoteAhead === 1 ? '1 commit' : `${remoteAhead} commits`;
  const lead = `origin/${branch} has ${noun} this worktree does not have.`;
  return isClean ? lead : `${lead} Commit or discard the local changes first.`;
};
