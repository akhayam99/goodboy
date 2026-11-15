import type { ProviderId } from '@goodboy/types';
import { openConnection } from '../connections/openConnection';

type Params = {
  readonly providerId: ProviderId;
};

export const openProviderCliUpdate = ({ providerId }: Params): void => {
  openConnection({ focus: { kind: 'provider', provider: providerId, action: 'update' } });
};
