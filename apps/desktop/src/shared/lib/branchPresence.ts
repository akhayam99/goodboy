import type { WorktreeStatus } from '@goodboy/types';
import { distanceAhead, distanceBehind } from './gitStatus';

export type BranchPresenceKind = 'on-origin' | 'local-only' | 'gone-on-origin' | 'merged';

export type BranchPresence = {
  readonly kind: BranchPresenceKind;
  readonly label: string;
  readonly toPush: number | null;
};

type PresenceParams = {
  readonly status: WorktreeStatus;
  readonly isMerged: boolean;
};

export const branchPresenceOf = ({ status, isMerged }: PresenceParams): BranchPresence => {
  if (isMerged) {
    return { kind: 'merged', label: 'Merged', toPush: null };
  }
  if (status.upstream == null) {
    return { kind: 'local-only', label: 'Local only', toPush: null };
  }
  if (
    status.upstreamDistance.kind === 'unknown' &&
    status.upstreamDistance.reason === 'upstream-gone'
  ) {
    return { kind: 'gone-on-origin', label: 'Gone on origin', toPush: null };
  }
  const ahead = distanceAhead({ distance: status.upstreamDistance });
  return {
    kind: 'on-origin',
    label: 'On origin',
    toPush: ahead != null && ahead > 0 ? ahead : null,
  };
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

export const branchPriorityWordOf = ({ presence, main }: PriorityParams): string => {
  if (presence.kind === 'merged') {
    return 'Merged';
  }
  if (presence.kind === 'gone-on-origin') {
    return 'Gone on origin';
  }
  if (presence.kind === 'local-only') {
    return 'Local only';
  }
  if (main.kind === 'behind-main') {
    return main.label;
  }
  return 'On origin';
};
