import type { AutoDelegation } from '@goodboy/db';
import { isAutoReturnDecided } from '../../../../features/auto/isAutoReturnDecided';
import type { ChildRefusal } from '../resolveDelegateChild';

export type TargetRefusalParams = Readonly<{
  target: AutoDelegation;
  delegations: ReadonlyArray<AutoDelegation>;
  batchTargets: ReadonlySet<string>;
  slot: number;
}>;

export const targetRefusalOf = ({
  target,
  delegations,
  batchTargets,
  slot,
}: TargetRefusalParams): ChildRefusal | null => {
  if (batchTargets.has(target.id)) {
    return {
      slot,
      code: 'retry_unavailable',
      message: 'another child of this block already continues or replaces that agent',
    };
  }
  if (target.outcome === 'blocked' && isAutoReturnDecided({ delegation: target, delegations })) {
    return {
      slot,
      code: 'retry_unavailable',
      message: 'you already decided about that agent: name the latest agent of that task',
    };
  }
  return null;
};
