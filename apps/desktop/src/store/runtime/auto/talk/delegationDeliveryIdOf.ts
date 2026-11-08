import type { AutoDelegation } from '@goodboy/db';
import { textFieldOf } from '../../../../shared/utils/textFieldOf';

export type DelegationDeliveryIdParams = Readonly<{
  delegation: Pick<AutoDelegation, 'request'>;
}>;

export const delegationDeliveryIdOf = ({ delegation }: DelegationDeliveryIdParams): string | null =>
  textFieldOf({ source: delegation.request, key: 'deliveryId' });
