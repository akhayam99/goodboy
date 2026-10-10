import type { GitUnknownReason, WorkspaceGitStatus } from '@goodboy/types';
import {
  changedCount,
  distanceAhead,
  distanceBehind,
  isWorkingTreeClean,
  operationLabel,
  unknownReasonLabel,
  unmergedCount,
} from './gitStatus';
import { dirtyTreeSentence } from './dirtyTreeCopy';

type Params = {
  readonly status: WorkspaceGitStatus | null;
};

type Presentation = {
  readonly actionableCount: number;
  readonly uncommittedCount: number;
  readonly branch: string;
  readonly isWarning: boolean;
};

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

type ProjectGitRowStatusKind =
  | 'behind'
  | 'up-to-date'
  | 'uncommitted'
  | 'diverged'
  | 'no-upstream'
  | 'detached'
  | 'rebase-stopped'
  | 'cant-read';

export type ProjectGitRowStatus = {
  readonly kind: ProjectGitRowStatusKind;
  readonly label: string;
  readonly updatable: boolean;
};

export const projectGitRowStatusOf = ({ status }: StatusParams): ProjectGitRowStatus => {
  if (status.branch == null) {
    return { kind: 'detached', label: 'Detached', updatable: false };
  }
  if (status.inProgress === 'rebase') {
    return { kind: 'rebase-stopped', label: 'Rebase stopped', updatable: false };
  }
  if (hasReadFailure({ status })) {
    return { kind: 'cant-read', label: "Can't read", updatable: false };
  }
  if (status.upstream == null) {
    return { kind: 'no-upstream', label: 'No upstream', updatable: false };
  }
  const unmerged = unmergedCount({ workingTree: status.workingTree }) ?? 0;
  const changed = changedCount({ workingTree: status.workingTree }) ?? 0;
  if (changed > unmerged) {
    return { kind: 'uncommitted', label: `${changed} uncommitted`, updatable: false };
  }
  const ahead = distanceAhead({ distance: status.upstreamDistance }) ?? 0;
  const behind = distanceBehind({ distance: status.upstreamDistance }) ?? 0;
  if (ahead > 0 && behind > 0) {
    return { kind: 'diverged', label: `Diverged ↑${ahead} ↓${behind}`, updatable: false };
  }
  if (behind > 0) {
    return { kind: 'behind', label: `${behind} behind`, updatable: true };
  }
  return { kind: 'up-to-date', label: 'Up to date', updatable: false };
};

export const projectGitPresentationOf = ({ status }: Params): Presentation => {
  const isReady = status?.state === 'ready';
  const branch = isReady
    ? (status.branch ?? 'detached HEAD')
    : status?.state === 'missing'
      ? 'Unreachable'
      : 'Git setup';
  if (!isReady) {
    return {
      actionableCount: 0,
      uncommittedCount: 0,
      branch,
      isWarning: status != null,
    };
  }
  const uncommittedCount =
    (changedCount({ workingTree: status.workingTree }) ?? 0) +
    (unmergedCount({ workingTree: status.workingTree }) ?? 0);
  const actionableCount =
    (distanceBehind({ distance: status.upstreamDistance }) ?? 0) + uncommittedCount;
  return {
    actionableCount,
    uncommittedCount,
    branch,
    isWarning: hasReadFailure({ status }),
  };
};
