import {
  DEFAULT_SESSION_PROVIDER_PREFERENCE,
  enabledProvidersOf,
  mergeLayers,
} from '@goodboy/core';
import type { ProviderId, SessionId, WorkspaceId } from '@goodboy/types';
import { selectModelContext, type ModelState } from './selectModelContext';

type Params = {
  readonly state: ModelState;
  readonly sessionId: SessionId | null;
  readonly workspaceId?: WorkspaceId | null;
};

export const liveEnabledProviders = ({
  state,
  sessionId,
  workspaceId = null,
}: Params): ReadonlyArray<ProviderId> | undefined => {
  const { layers } = selectModelContext({ state, sessionId, workspaceId });
  const merged = mergeLayers(layers);
  return enabledProvidersOf({
    policy: merged.providerPool,
    fallbackDefault:
      merged.defaultProviderId ?? DEFAULT_SESSION_PROVIDER_PREFERENCE.defaultProvider,
  });
};
