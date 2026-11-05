import { parseAutoDelegationRole } from '@goodboy/core/auto';
import type { AutoDelegation } from '@goodboy/db';

export type AutoCardHead = Readonly<{
  name: string;
  meta: string;
  word: string;
  isOpen: boolean;
}>;

type Params = {
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

const BUILDING_ROLES: ReadonlySet<string> = new Set(['implementer', 'tester', 'rewriter']);

export const autoCardHeadOf = ({ delegations }: Params): AutoCardHead => {
  const roles = delegations.map((delegation) => parseAutoDelegationRole({ role: delegation.role }));
  const isPlanning = roles.length > 0 && roles.every((role) => role === 'planner');
  const isBuilding = roles.some((role) => role !== null && BUILDING_ROLES.has(role));
  const isOpen = delegations.some((delegation) => delegation.state !== 'settled');
  const count = delegations.length;
  return {
    name: isPlanning ? 'Planning' : isBuilding ? 'Building' : 'Working',
    meta: count === 1 ? '1 agent' : `${count} agents`,
    word: isOpen ? 'Running' : 'Done',
    isOpen,
  };
};
