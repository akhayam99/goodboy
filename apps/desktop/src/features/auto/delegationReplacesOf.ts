import type { AutoDelegation } from '@goodboy/db';
import { textField } from './chat/readJson';

type Params = {
  readonly delegation: Pick<AutoDelegation, 'request'>;
};

export const delegationReplacesOf = ({ delegation }: Params): string | null =>
  textField({ source: delegation.request, key: 'replaces' });
