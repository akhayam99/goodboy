import type { AutoDelegation } from '@goodboy/db';
import { recordField, textField } from './chat/readJson';

type Params = {
  readonly delegation: Pick<AutoDelegation, 'request'>;
};

export const delegationReleaseOf = ({ delegation }: Params): string | null => {
  const released = recordField({ source: delegation.request, key: 'released' });
  if (released === null) {
    return null;
  }
  return textField({ source: released, key: 'reason' }) ?? '';
};
