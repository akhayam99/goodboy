import type { Session, SessionProviderPreference } from '@goodboy/types';
import { liveEnabledProviders } from './liveEnabledProviders';
import type { ModelState } from './selectModelContext';

type Params = {
  readonly state: ModelState;
  readonly session: Session;
};

export const liveSessionPreference = ({ state, session }: Params): SessionProviderPreference => {
  const { defaultProvider, defaultModel, allowTurnOverride } = session.providerPreference;
  const enabled = liveEnabledProviders({ state, sessionId: session.id });
  return {
    defaultProvider,
    allowTurnOverride,
    ...(defaultModel !== undefined && { defaultModel }),
    ...(enabled !== undefined && { enabledProviders: enabled }),
  };
};
