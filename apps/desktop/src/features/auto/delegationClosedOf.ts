import { AUTO_CLOSE_AS, type AutoCloseAs } from '@goodboy/core/auto';
import type { AutoDelegation } from '@goodboy/db';
import { recordField, textField } from './chat/readJson';

export type AutoClosedMark = Readonly<{
  as: AutoCloseAs;
  reason: string;
}>;

type Params = {
  readonly delegation: Pick<AutoDelegation, 'request'>;
};

export const delegationClosedOf = ({ delegation }: Params): AutoClosedMark | null => {
  const closed = recordField({ source: delegation.request, key: 'closed' });
  if (closed === null) {
    return null;
  }
  const as = AUTO_CLOSE_AS.find((candidate) => candidate === closed['as']);
  if (as === undefined) {
    return null;
  }
  return { as, reason: textField({ source: closed, key: 'reason' }) ?? '' };
};
