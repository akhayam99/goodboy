import type { AutoDelegation, AutoOutboxRow, AutoTree } from '@goodboy/db';
import { isAutoReturnDecided } from '../../../../features/auto/isAutoReturnDecided';
import { isLegacyBlock } from './isLegacyBlock';

export type UnheardReturnParams = Readonly<{
  joined: AutoOutboxRow;
  tree: Pick<AutoTree, 'activeRunId'>;
  batch: ReadonlyArray<AutoDelegation>;
  delivered: ReadonlySet<string>;
  delegations: ReadonlyArray<AutoDelegation>;
}>;

export const hasUnheardReturn = ({
  joined,
  tree,
  batch,
  delivered,
  delegations,
}: UnheardReturnParams): boolean =>
  joined.state === 'accepted' &&
  joined.acceptedRunId !== tree.activeRunId &&
  batch.some(
    (delegation) =>
      delegation.state === 'settled' &&
      delegation.outcome === 'blocked' &&
      !delivered.has(delegation.id) &&
      !isLegacyBlock({ delegation }) &&
      !isAutoReturnDecided({ delegation, delegations }),
  );
