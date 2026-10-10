import type { AutoModelChoice } from '@goodboy/core';
import type { AgentRole, ProviderId, SessionId } from '@goodboy/types';
import type { ModelState } from './selectModelContext';
import { selectResolution } from './selectResolution';

type Params = {
  readonly state: ModelState;
  readonly sessionId: SessionId;
  readonly role: AgentRole;
  readonly provider: ProviderId;
};

export const selectModelOnProvider = ({
  state,
  sessionId,
  role,
  provider,
}: Params): AutoModelChoice | null => {
  const resolution = selectResolution({
    state,
    sessionId,
    slot: { kind: 'role', id: role },
    providers: [provider],
  });
  return resolution.provider === provider
    ? { provider: resolution.provider, model: resolution.model }
    : null;
};
