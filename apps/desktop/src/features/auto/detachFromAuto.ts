import type { Database } from '@goodboy/db';
import type { AgentId, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../shared/lib/db';
import type { AppStore } from '../../store/store';
import { detachAdopted, type DetachOutcome } from '../../store/runtime/auto/detachAdopted';

export type DetachFromAutoParams = Readonly<{
  getState: () => AppStore;
  db?: Database;
  sessionId: SessionId;
  agentId: AgentId;
}>;

export const detachFromAuto = async ({
  getState,
  db = tauriDatabase,
  sessionId,
  agentId,
}: DetachFromAutoParams): Promise<DetachOutcome> => {
  const outcome = await detachAdopted({ db, agentId, nowMs: Date.now() });
  if (outcome.kind === 'detached') {
    await getState().loadAutoTrees({ sessionId });
  }
  return outcome;
};
