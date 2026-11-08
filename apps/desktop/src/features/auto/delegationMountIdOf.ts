import type { AutoDelegation } from '@goodboy/db';
import { textField } from './chat/readJson';

type Params = {
  readonly delegation: Pick<AutoDelegation, 'target'>;
};

export const delegationMountIdOf = ({ delegation }: Params): string | null =>
  textField({ source: delegation.target, key: 'mountId' });
