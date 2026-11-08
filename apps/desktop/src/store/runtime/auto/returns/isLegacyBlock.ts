import type { AutoDelegation } from '@goodboy/db';
import { recordField } from '../../../../features/auto/chat/readJson';

export type LegacyBlockParams = Readonly<{
  delegation: AutoDelegation;
}>;

export const isLegacyBlock = ({ delegation }: LegacyBlockParams): boolean =>
  delegation.state === 'settled' &&
  delegation.outcome === 'blocked' &&
  recordField({ source: delegation.result, key: 'returned' }) === null;
