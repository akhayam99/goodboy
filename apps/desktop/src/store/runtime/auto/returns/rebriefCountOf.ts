import type { AutoDelegation } from '@goodboy/db';
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
      return replaces === null ? [] : [replaces];
    }),
  ).size;
