import { parseAutoDelegationRole } from '@goodboy/core/auto';
import type { AutoDelegation, AutoOutcome } from '@goodboy/db';
import { settledStatusOf } from './settledStatusOf';

export type AutoCardHead = Readonly<{
  name: string;
  meta: string;
  word: string;
  isOpen: boolean;
}>;

type Params = {
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

type WordParams = Params & {
  readonly isOpen: boolean;
};

const BUILDING_ROLES: ReadonlySet<string> = new Set(['implementer', 'tester', 'rewriter']);

const NEEDS_YOU_STATES: ReadonlySet<string> = new Set(['awaiting_confirm', 'paused']);

const WORST_FIRST: ReadonlyArray<AutoOutcome> = ['failed', 'timed_out', 'blocked', 'stopped'];

const headWordOf = ({ delegations, isOpen }: WordParams): string => {
  if (delegations.some((delegation) => NEEDS_YOU_STATES.has(delegation.state))) {
    return 'Needs you';
  }
  const worst = WORST_FIRST.find((outcome) =>
    delegations.some((delegation) => delegation.outcome === outcome),
  );
  if (worst === 'failed' || worst === 'timed_out') {
    return 'Failed';
  }
  if (isOpen) {
    return 'Running';
  }
  return settledStatusOf({ outcome: worst ?? 'completed' }).word;
};

export const autoCardHeadOf = ({ delegations }: Params): AutoCardHead => {
  const roles = delegations.map((delegation) => parseAutoDelegationRole({ role: delegation.role }));
  const isPlanning = roles.length > 0 && roles.every((role) => role === 'planner');
  const isBuilding = roles.some((role) => role !== null && BUILDING_ROLES.has(role));
  const isOpen = delegations.some((delegation) => delegation.state !== 'settled');
  const count = delegations.length;
  return {
    name: isPlanning ? 'Plan' : isBuilding ? 'Build' : 'Review',
    meta: count === 1 ? '1 agent' : `${count} agents`,
    word: headWordOf({ delegations, isOpen }),
    isOpen,
  };
};
