import type { ProviderConnectionState, ProviderId } from '@goodboy/types';
import { openConnection } from '../connections/openConnection';

type Params = {
  readonly providerId: ProviderId;
  readonly connection: ProviderConnectionState;
};

export const openProviderConnect = ({ providerId, connection }: Params): void => {
  openConnection({
    focus: {
      kind: 'provider',
      provider: providerId,
      action: connection === 'missing' ? 'install' : 'login',
    },
  });
};
