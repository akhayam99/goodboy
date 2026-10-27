import type { Session, SessionProviderPreference } from '@goodboy/types';
import { liveEnabledProviders } from './liveEnabledProviders';
import type { ModelState } from './selectModelContext';

type Params = {
  readonly state: ModelState;
  readonly session: Session;
};

export const liveSessionPreference = ({ state, session }: Params): SessionProviderPreference => {
  const stored = session.providerPreference;
  const enabled = liveEnabledProviders({ state, sessionId: session.id });
  const [first] = enabled ?? [];
  const isDefaultOut = enabled !== undefined && !enabled.includes(stored.defaultProvider);
  if (isDefaultOut && first !== undefined) {
    return {
      defaultProvider: first,
      allowTurnOverride: stored.allowTurnOverride,
      enabledProviders: enabled,
    };
  }
  return {
    defaultProvider: stored.defaultProvider,
    allowTurnOverride: stored.allowTurnOverride,
    ...(stored.defaultModel !== undefined && { defaultModel: stored.defaultModel }),
    ...(enabled !== undefined && { enabledProviders: enabled }),
  };
};
