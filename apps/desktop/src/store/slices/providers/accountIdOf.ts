import type { ProviderId } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../../features/providers/providers';

type Params = {
  readonly providers: ReadonlyArray<ProviderDisplayInfo>;
  readonly providerId: ProviderId;
};

export const accountIdOf = ({ providers, providerId }: Params): string =>
  providers.find((provider) => provider.id === providerId)?.identity ?? '';
