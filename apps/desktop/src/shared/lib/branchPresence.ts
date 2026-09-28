import type { WorktreeStatus } from '@goodboy/types';
import { distanceBehind } from './gitStatus';
import { branchPushStateOf } from './branchPushState';
import { mergedThenLabel } from './mergedThen';

export type BranchPresenceKind =
  'on-origin' | 'diverged' | 'local-only' | 'gone-on-origin' | 'merged' | 'merged-then';

export type BranchPresence = {
  readonly kind: BranchPresenceKind;
  readonly label: string;
  readonly toPush: number | null;
};

type PresenceParams = {
  readonly status: WorktreeStatus;
  readonly isMerged: boolean;
  readonly commitsAfterMerge?: number | null;
};

export const branchPresenceOf = ({
  status,
  isMerged,
  commitsAfterMerge = null,
}: PresenceParams): BranchPresence => {
  if (commitsAfterMerge !== null && commitsAfterMerge > 0) {
    return { kind: 'merged-then', label: mergedThenLabel(commitsAfterMerge), toPush: null };
  }
  if (isMerged) {
    return { kind: 'merged', label: 'Merged', toPush: null };
  }
  const push = branchPushStateOf({ status });
  if (push.kind === 'not-pushed') {
    return { kind: 'local-only', label: 'Local only', toPush: null };
  }
  if (push.kind === 'gone') {
    return { kind: 'gone-on-origin', label: 'Gone on origin', toPush: null };
  }
  if (push.kind === 'diverged') {
    return { kind: 'diverged', label: 'Diverged from origin', toPush: null };
  }
  return {
    kind: 'on-origin',
    label: 'On origin',
    toPush: push.kind === 'ahead' ? push.ahead : null,
  };
};

type MergedParams = {
  readonly status: WorktreeStatus | null;
  readonly baseBranch: string | null;
  readonly isMainCheckout: boolean;
  readonly isRequestMerged: boolean;
  readonly commitsAfterMerge?: number | null;
};

const tracksOwnBranch = ({ status }: { readonly status: WorktreeStatus }): boolean => {
  if (status.branch === null || status.upstream === null) {
    return false;
  }
  const slash = status.upstream.indexOf('/');
  return slash >= 0 && status.upstream.slice(slash + 1) === status.branch;
};

export const isBranchMergedOf = ({
  status,
  baseBranch,
  isMainCheckout,
  isRequestMerged,
  commitsAfterMerge = null,
}: MergedParams): boolean => {
  if (commitsAfterMerge !== null && commitsAfterMerge > 0) {
    return false;
  }
  if (isRequestMerged) {
    return true;
  }
  if (status === null || isMainCheckout || status.inProgress !== null) {
    return false;
  }
  if (status.branch === null || status.branch === (baseBranch ?? 'main')) {
    return false;
  }
  if (status.workingTree.kind !== 'known' || status.workingTree.changed > 0) {
    return false;
  }
  if (status.mainDistance.kind !== 'known' || status.mainDistance.ahead > 0) {
    return false;
  }
  return tracksOwnBranch({ status });
};

export type MainPresenceKind = 'behind-main' | 'up-to-date' | 'rebasing-on-main' | 'rebase-stopped';

export type MainPresence = {
  readonly kind: MainPresenceKind;
  readonly label: string;
  readonly behind: number | null;
};

type MainPresenceParams = {
  readonly status: WorktreeStatus;
  readonly isRebasingAgent: boolean;
};

export const mainPresenceOf = ({ status, isRebasingAgent }: MainPresenceParams): MainPresence => {
  if (isRebasingAgent) {
    return { kind: 'rebasing-on-main', label: 'Rebasing on main', behind: null };
  }
  if (status.inProgress === 'rebase') {
    return { kind: 'rebase-stopped', label: 'Rebase stopped', behind: null };
  }
  const behind = distanceBehind({ distance: status.mainDistance });
  if (behind != null && behind > 0) {
    return { kind: 'behind-main', label: `Behind main by ${behind}`, behind };
  }
  return { kind: 'up-to-date', label: 'Up to date', behind: 0 };
};

type PriorityParams = {
  readonly presence: BranchPresence;
  readonly main: MainPresence;
};

export type BranchPriorityKind =
  BranchPresenceKind | 'behind-main' | 'rebase-stopped' | 'rebasing-on-main';

export type BranchPriority = {
  readonly kind: BranchPriorityKind;
  readonly word: string;
};

export const branchPriorityOf = ({ presence, main }: PriorityParams): BranchPriority => {
  if (main.kind === 'rebase-stopped' || main.kind === 'rebasing-on-main') {
    return { kind: main.kind, word: main.label };
  }
  if (presence.kind !== 'on-origin') {
    return { kind: presence.kind, word: presence.label };
  }
  if (main.kind === 'behind-main') {
    return { kind: 'behind-main', word: main.label };
  }
  return { kind: 'on-origin', word: presence.label };
};
