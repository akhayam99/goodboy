import type { ProviderConnectionState, ProviderId } from '@goodboy/types';

type Params = {
  readonly providerId: ProviderId;
  readonly connection: ProviderConnectionState;
};

export const openProviderConnect = ({ providerId, connection }: Params): void => {
  window.dispatchEvent(
    new CustomEvent('goodboy:open-settings', {
      detail: {
        scope: 'providers',
        provider: providerId,
        action: connection === 'missing' ? 'install' : 'login',
        door: true,
      },
    }),
  );
};
