import type { WorktreeStatus } from '@goodboy/types';
import { distanceAhead } from './gitStatus';

export type BranchPushState =
  | { readonly kind: 'in-sync' }
  | { readonly kind: 'ahead'; readonly ahead: number }
  | { readonly kind: 'behind'; readonly behind: number }
  | { readonly kind: 'diverged'; readonly ahead: number; readonly behind: number }
  | { readonly kind: 'not-pushed'; readonly commits: number | null }
  | { readonly kind: 'gone' }
  | { readonly kind: 'unknown' };

type Params = {
  readonly status: Pick<WorktreeStatus, 'upstreamDistance' | 'mainDistance'>;
};

export const branchPushStateOf = ({ status }: Params): BranchPushState => {
  const distance = status.upstreamDistance;
  if (distance.kind === 'known') {
    if (distance.ahead > 0 && distance.behind > 0) {
      return { kind: 'diverged', ahead: distance.ahead, behind: distance.behind };
    }
    if (distance.ahead > 0) {
      return { kind: 'ahead', ahead: distance.ahead };
    }
    if (distance.behind > 0) {
      return { kind: 'behind', behind: distance.behind };
    }
    return { kind: 'in-sync' };
  }
  if (distance.reason === 'no-upstream') {
    return { kind: 'not-pushed', commits: distanceAhead({ distance: status.mainDistance }) };
  }
  if (distance.reason === 'upstream-gone') {
    return { kind: 'gone' };
  }
  return { kind: 'unknown' };
};

type CountParams = {
  readonly state: BranchPushState;
};

export const commitsToPush = ({ state }: CountParams): number => {
  switch (state.kind) {
    case 'ahead':
      return state.ahead;
    case 'not-pushed':
      return state.commits ?? 0;
    case 'in-sync':
    case 'behind':
    case 'diverged':
    case 'gone':
    case 'unknown':
      return 0;
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};
