import type { ProviderDisplayInfo } from '../../../features/providers/providers';
import { connectionOfHealth, type ProviderHealthMap } from './providerHealth';

type Params = {
  readonly providers: ReadonlyArray<ProviderDisplayInfo>;
  readonly health: ProviderHealthMap;
};

export const overlayProviderHealth = ({
  providers,
  health,
}: Params): ReadonlyArray<ProviderDisplayInfo> =>
  providers.map((provider) => {
    const entry = health[provider.id];
    const connection =
      entry.standing === 'unknown' ? provider.connection : connectionOfHealth({ health: entry });
    return {
      ...provider,
      connection,
      identity:
        connection === 'connected' ? (provider.identity ?? entry.identity) : provider.identity,
      standing: entry.standing,
      isBreakerOpen: entry.isBreakerOpen,
    };
  });
