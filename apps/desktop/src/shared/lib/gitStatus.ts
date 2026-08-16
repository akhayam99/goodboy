import type { GitDistance, GitOperation, GitUnknownReason, GitWorkingTree } from '@goodboy/types';

type DistanceParams = {
  readonly distance: GitDistance;
};

type WorkingTreeParams = {
  readonly workingTree: GitWorkingTree;
};

type ReasonParams = {
  readonly reason: GitUnknownReason;
};

type OperationParams = {
  readonly operation: GitOperation;
};

export const distanceAhead = ({ distance }: DistanceParams): number | null => {
  return distance.kind === 'known' ? distance.ahead : null;
};

export const distanceBehind = ({ distance }: DistanceParams): number | null => {
  return distance.kind === 'known' ? distance.behind : null;
};

export const changedCount = ({ workingTree }: WorkingTreeParams): number | null => {
  return workingTree.kind === 'known' ? workingTree.changed : null;
};

export const unmergedCount = ({ workingTree }: WorkingTreeParams): number | null => {
  return workingTree.kind === 'known' ? workingTree.unmerged : null;
};

export const isWorkingTreeClean = ({ workingTree }: WorkingTreeParams): boolean => {
  return workingTree.kind === 'known' && workingTree.changed === 0;
};

export const unknownReasonLabel = ({ reason }: ReasonParams): string => {
  switch (reason) {
    case 'no-upstream':
      return 'this branch tracks no upstream yet';
    case 'detached-head':
      return 'this checkout is on a detached HEAD';
    case 'rev-list-failed':
      return 'git could not compare this branch with its upstream';
    case 'main-ref-unresolved':
      return 'git could not resolve a main branch to compare against';
    case 'status-read-failed':
      return 'git status could not be read';
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
};

export const operationLabel = ({ operation }: OperationParams): string => {
  switch (operation) {
    case 'merge':
      return 'merge';
    case 'rebase':
      return 'rebase';
    case 'cherry-pick':
      return 'cherry-pick';
    case 'bisect':
      return 'bisect';
    default: {
      const exhaustive: never = operation;
      return exhaustive;
    }
  }
};
