import type { WorktreeStatus } from '@goodboy/types';
import { branchPushFactsOf } from '../../shared/lib/branchPushState';
import { distanceAhead, distanceBehind } from '../../shared/lib/gitStatus';

type BranchStartState = 'unknown' | 'empty' | 'unpushed' | 'pushed' | 'behind' | 'conflict';

export type BranchNextStep = {
  readonly state: BranchStartState;
  readonly ahead: number | null;
  readonly behind: number | null;
  readonly unpushed: number;
  readonly isPushed: boolean;
  readonly diverged: { readonly yours: number; readonly online: number } | null;
  readonly header: 'push' | 'rebase' | null;
  readonly submit: 'primary' | 'secondary' | null;
};

type Params = {
  readonly status: Pick<WorktreeStatus, 'upstreamDistance' | 'mainDistance' | 'inProgress'> | null;
  readonly hasConflictStop: boolean;
};

type StepParams = {
  readonly state: BranchStartState;
};

const stepOf = ({ state }: StepParams): Pick<BranchNextStep, 'header' | 'submit'> => {
  switch (state) {
    case 'unknown':
    case 'pushed':
      return { header: null, submit: 'primary' };
    case 'unpushed':
      return { header: 'push', submit: 'secondary' };
    case 'behind':
      return { header: 'rebase', submit: 'secondary' };
    case 'empty':
    case 'conflict':
      return { header: null, submit: null };
    default: {
      const unexpected: never = state;
      return unexpected;
    }
  }
};

type StateParams = {
  readonly ahead: number | null;
  readonly behind: number | null;
  readonly unpushed: number;
  readonly isConflict: boolean;
};

const stateOf = ({ ahead, behind, unpushed, isConflict }: StateParams): BranchStartState => {
  if (isConflict) {
    return 'conflict';
  }
  if (ahead === null) {
    return 'unknown';
  }
  if (ahead === 0) {
    return 'empty';
  }
  if (behind !== null && behind > 0) {
    return 'behind';
  }
  return unpushed > 0 ? 'unpushed' : 'pushed';
};

export const branchNextStepOf = ({ status, hasConflictStop }: Params): BranchNextStep => {
  const ahead = status === null ? null : distanceAhead({ distance: status.mainDistance });
  const behind = status === null ? null : distanceBehind({ distance: status.mainDistance });
  const push = branchPushFactsOf({ status });
  const pushState = status === null ? null : push.state;
  const unpushed = push.toPush;
  const isPushed =
    pushState !== null &&
    pushState.kind !== 'not-pushed' &&
    pushState.kind !== 'gone' &&
    pushState.kind !== 'unknown';
  const diverged =
    push.state.kind === 'diverged' ? { yours: push.state.ahead, online: push.state.behind } : null;
  const state = stateOf({
    ahead,
    behind,
    unpushed,
    isConflict: hasConflictStop || status?.inProgress === 'rebase',
  });
  return { state, ahead, behind, unpushed, isPushed, diverged, ...stepOf({ state }) };
};
