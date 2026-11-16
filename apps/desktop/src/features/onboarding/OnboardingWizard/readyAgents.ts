import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';
import type { ProviderDisplayInfo } from '../../providers/providers';

type Params = {
  readonly providers: ReadonlyArray<ProviderDisplayInfo>;
};

export const readyAgents = ({ providers }: Params): ReadonlyArray<ProviderId> =>
  PROVIDER_IDS.filter((id) =>
    providers.some((provider) => provider.id === id && provider.connection === 'connected'),
  );
