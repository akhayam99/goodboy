import type { BranchCommit, WorktreeStatus } from '@goodboy/types';
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

const commitsToPush = ({ state }: CountParams): number => {
  switch (state.kind) {
    case 'ahead':
    case 'diverged':
      return state.ahead;
    case 'not-pushed':
      return state.commits ?? 0;
    case 'in-sync':
    case 'behind':
    case 'gone':
    case 'unknown':
      return 0;
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

type FactsParams = {
  readonly status:
    | (Pick<WorktreeStatus, 'upstreamDistance' | 'mainDistance'> &
        Partial<Pick<WorktreeStatus, 'upstream'>>)
    | null;
  readonly commits?: ReadonlyArray<Pick<BranchCommit, 'pushed'>> | null;
  readonly hasRemoteHead?: boolean;
};

export type BranchPushFacts = {
  readonly state: BranchPushState;
  readonly toPush: number;
  readonly canForce: boolean;
};

const UNKNOWN_FACTS: BranchPushFacts = { state: { kind: 'unknown' }, toPush: 0, canForce: false };

export const branchPushFactsOf = ({
  status,
  commits = null,
  hasRemoteHead = false,
}: FactsParams): BranchPushFacts => {
  const hasUpstream = (status !== null && (status.upstream ?? null) !== null) || hasRemoteHead;
  const loaded = commits !== null && hasUpstream ? commits : null;
  if (status === null) {
    return loaded === null
      ? UNKNOWN_FACTS
      : { ...UNKNOWN_FACTS, toPush: loaded.filter((commit) => !commit.pushed).length };
  }
  const state = branchPushStateOf({ status });
  return {
    state,
    toPush:
      loaded === null ? commitsToPush({ state }) : loaded.filter((commit) => !commit.pushed).length,
    canForce: state.kind === 'diverged',
  };
};
