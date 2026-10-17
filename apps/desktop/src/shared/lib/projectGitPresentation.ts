import type { GitUnknownReason, WorkspaceGitStatus } from '@goodboy/types';
import { isWorkingTreeClean, operationLabel, unknownReasonLabel } from './gitStatus';
import { dirtyTreeSentence } from './dirtyTreeCopy';

type ReasonParams = {
  readonly reason: GitUnknownReason;
};

type StatusParams = {
  readonly status: WorkspaceGitStatus;
};

const isReadFailureReason = ({ reason }: ReasonParams): boolean => {
  switch (reason) {
    case 'no-upstream':
    case 'detached-head':
      return false;
    case 'rev-list-failed':
    case 'main-ref-unresolved':
    case 'status-read-failed':
    case 'upstream-gone':
      return true;
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
};

export const hasReadFailure = ({ status }: StatusParams): boolean =>
  (status.upstreamDistance.kind === 'unknown' &&
    isReadFailureReason({ reason: status.upstreamDistance.reason })) ||
  (status.workingTree.kind === 'unknown' &&
    isReadFailureReason({ reason: status.workingTree.reason }));

export const projectUpdateBlockReasonOf = ({ status }: StatusParams): string | null => {
  if (status.branch == null) {
    return unknownReasonLabel({ reason: 'detached-head' });
  }
  if (status.upstream == null) {
    return 'this branch tracks no upstream yet';
  }
  if (status.inProgress != null) {
    return `finish the ${operationLabel({ operation: status.inProgress })} in progress first`;
  }
  if (status.workingTree.kind === 'unknown') {
    return unknownReasonLabel({ reason: status.workingTree.reason });
  }
  if (!isWorkingTreeClean({ workingTree: status.workingTree })) {
    return dirtyTreeSentence({ count: status.workingTree.changed });
  }
  if (status.upstreamDistance.kind === 'unknown') {
    return unknownReasonLabel({ reason: status.upstreamDistance.reason });
  }
  if (status.upstreamDistance.behind === 0) {
    return 'already up to date';
  }
  return null;
};
