import type { ProviderId } from '@goodboy/types';

type Params = {
  readonly providerId: ProviderId | null;
};

export const openProviderUsage = ({ providerId }: Params): void => {
  window.dispatchEvent(
    new CustomEvent('goodboy:open-settings', {
      detail:
        providerId === null
          ? { scope: 'providers' }
          : { scope: 'providers', provider: providerId, section: 'usage' },
    }),
  );
};
