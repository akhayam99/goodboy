import type { ProviderId } from '@goodboy/types';
import { logProviderStanding } from './logProviderStanding';
import { overlayProviderHealth } from './overlayProviderHealth';
import {
  INITIAL_HEALTH_MAP,
  reduceProviderHealth,
  type HealthAction,
  type ProviderHealth,
} from './providerHealth';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly providerId: ProviderId;
  readonly action: HealthAction;
};

export const applyProviderHealthAction = ({ set, get, providerId, action }: Params): void => {
  const state = get();
  const previous = state.providerHealth ?? INITIAL_HEALTH_MAP;
  const result = reduceProviderHealth({ health: previous[providerId], action });
  const next: Record<ProviderId, ProviderHealth> = { ...previous, [providerId]: result.health };
  const overlaid = overlayProviderHealth({
    providers: state.providers.filter((provider) => provider.id === providerId),
    health: next,
  });
  set({
    providerHealth: next,
    providers: state.providers.map(
      (provider) => overlaid.find((candidate) => candidate.id === provider.id) ?? provider,
    ),
  });
  for (const event of result.events) {
    logProviderStanding({ providerId, event });
  }
};
