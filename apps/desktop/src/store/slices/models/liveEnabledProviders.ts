import {
  DEFAULT_SESSION_PROVIDER_PREFERENCE,
  enabledProvidersOf,
  mergeLayers,
} from '@goodboy/core';
import type { ProviderId, SessionId } from '@goodboy/types';
import { selectModelContext, type ModelState } from './selectModelContext';

type Params = {
  readonly state: ModelState;
  readonly sessionId: SessionId | null;
};

export const liveEnabledProviders = ({
  state,
  sessionId,
}: Params): ReadonlyArray<ProviderId> | undefined => {
  const { layers } = selectModelContext({ state, sessionId });
  const merged = mergeLayers(layers);
  return enabledProvidersOf({
    policy: merged.providerPool,
    fallbackDefault:
      merged.defaultProviderId ?? DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider,
  });
};
