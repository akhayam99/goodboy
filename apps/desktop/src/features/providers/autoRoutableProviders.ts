import type { ProviderId } from '@goodboy/types';
import type { ProviderDisplayInfo } from './providers';

type Params = {
  readonly providers: ReadonlyArray<ProviderDisplayInfo>;
  readonly pinned?: ProviderId | null;
};

export const autoRoutableProviders = ({ providers, pinned = null }: Params): ProviderId[] =>
  providers
    .filter(
      (provider) =>
        provider.connection === 'connected' &&
        (provider.isBreakerOpen !== true || provider.id === pinned),
    )
    .map((provider) => provider.id);
