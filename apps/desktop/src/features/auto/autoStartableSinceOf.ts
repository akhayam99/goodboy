import { AUTO_DELEGATION_DEADLINE_MINUTES, AUTO_MAX_RUNNING_CHILDREN } from '@goodboy/core/auto';
import type { AutoDelegation, AutoTree } from '@goodboy/db';

type Params = {
  readonly tree: Pick<AutoTree, 'phase' | 'activeRunId'>;
  readonly delegations: ReadonlyArray<Pick<AutoDelegation, 'state' | 'settledAt'>>;
  readonly delegation: Pick<AutoDelegation, 'state' | 'createdAt' | 'deadlineAt'>;
};

const LAUNCH_PHASES: ReadonlyArray<AutoTree['phase']> = ['delegating', 'waiting', 'merging'];

export const autoStartableSinceOf = ({ tree, delegations, delegation }: Params): number | null => {
  if (delegation.state !== 'accepted') {
    return delegation.deadlineAt - AUTO_DELEGATION_DEADLINE_MINUTES * 60_000;
  }
  if (tree.activeRunId !== null || !LAUNCH_PHASES.includes(tree.phase)) {
    return null;
  }
  const held = delegations.filter(
    (sibling) => sibling.state === 'starting' || sibling.state === 'running',
  ).length;
  if (held >= AUTO_MAX_RUNNING_CHILDREN) {
    return null;
  }
  const freedAt = Math.max(0, ...delegations.map((sibling) => sibling.settledAt ?? 0));
  return Math.max(delegation.createdAt, freedAt);
};
