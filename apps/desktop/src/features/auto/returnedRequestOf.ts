import type { AutoDelegation } from '@goodboy/db';
import { recordField, textField } from './chat/readJson';

type Params = {
  readonly delegation: Pick<AutoDelegation, 'result'>;
};

export const returnedRequestOf = ({ delegation }: Params): string | null =>
  textField({
    source: recordField({ source: delegation.result, key: 'returned' }),
    key: 'request',
  });
