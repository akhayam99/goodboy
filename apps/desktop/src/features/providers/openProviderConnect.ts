import type { ProviderConnectionState, ProviderId } from '@goodboy/types';
import { openSettings } from '../settings/openSettings';

type Params = {
  readonly providerId: ProviderId;
  readonly connection: ProviderConnectionState;
};

export const openProviderConnect = ({ providerId, connection }: Params): void => {
  openSettings({
    scope: 'providers',
    provider: providerId,
    action: connection === 'missing' ? 'install' : 'login',
    door: true,
  });
};
