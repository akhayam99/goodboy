import type { AutoDelegation } from '@goodboy/db';
import { lineageOf } from './lineageOf';

type Link = Pick<AutoDelegation, 'id' | 'retryOf' | 'request' | 'state' | 'outcome'>;

export type ReturnCountParams = Readonly<{
  delegation: Link;
  delegations: ReadonlyArray<Link>;
}>;

export const returnCountOf = ({ delegation, delegations }: ReturnCountParams): number =>
  lineageOf({ delegation, delegations, shouldFollowReplaces: false }).filter(
    (row) => row.state === 'settled' && row.outcome === 'blocked',
  ).length;
