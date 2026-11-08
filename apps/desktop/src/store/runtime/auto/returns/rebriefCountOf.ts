import type { AutoDelegation } from '@goodboy/db';
import { delegationContinueOf } from '../../../../features/auto/delegationContinueOf';
import { delegationReplacesOf } from '../../../../features/auto/delegationReplacesOf';
import { lineageOf } from './lineageOf';

type Link = Pick<AutoDelegation, 'id' | 'retryOf' | 'request'>;

export type RebriefCountParams = Readonly<{
  delegation: Link;
  delegations: ReadonlyArray<Link>;
}>;

export const rebriefCountOf = ({ delegation, delegations }: RebriefCountParams): number =>
  new Set(
    lineageOf({ delegation, delegations, shouldFollowReplaces: true }).flatMap((row) => {
      const replaces = delegationReplacesOf({ delegation: row });
      if (replaces !== null) {
        return [`replaces:${replaces}`];
      }
      return delegationContinueOf({ delegation: row })?.from === 'auto'
        ? [`continue:${row.id}`]
        : [];
    }),
  ).size;
