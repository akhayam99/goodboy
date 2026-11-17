import type { AutoDelegation } from '@goodboy/db';
import { numberField, recordField } from './chat/readJson';

type Params = {
  readonly delegation: Pick<AutoDelegation, 'request'>;
};

export const planKeptBaseOf = ({ delegation }: Params): number | null =>
  numberField({
    source: recordField({ source: delegation.request, key: 'keptBase' }),
    key: 'revision',
  });
