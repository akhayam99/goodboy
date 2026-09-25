import type { ProviderId } from '@goodboy/types';

type Params = {
  readonly providerId: ProviderId;
};

export const openProviderCliUpdate = ({ providerId }: Params): void => {
  window.dispatchEvent(
    new CustomEvent('goodboy:open-settings', {
      detail: { scope: 'providers', provider: providerId, action: 'update' },
    }),
  );
};
