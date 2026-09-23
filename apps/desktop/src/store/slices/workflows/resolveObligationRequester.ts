import { getAgentById } from '@goodboy/db';
import type { Agent, CapabilityObligation, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly obligation: CapabilityObligation;
};

export const resolveObligationRequester = async ({
  get,
  sessionId,
  obligation,
}: Params): Promise<Agent | null> => {
  const loaded = (get().sessionPhaseRuns[sessionId] ?? []).find(
    (agent) => agent.id === obligation.requesterAgentId,
  );
  if (loaded !== undefined) {
    return loaded;
  }
  const persisted = await getAgentById(tauriDatabase, obligation.requesterAgentId).catch(
    () => null,
  );
  if (persisted === null || persisted.sessionId !== sessionId) {
    return null;
  }
  return persisted;
};
