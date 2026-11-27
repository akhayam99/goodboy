import type { LeadLastTurn } from '@goodboy/core/auto';
import { readAgentLastCleanTurn } from '@goodboy/db';
import type { AgentId, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';

type Params = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
}>;

export const readLeadLastTurn = async ({
  sessionId,
  agentId,
}: Params): Promise<LeadLastTurn | null> =>
  readAgentLastCleanTurn({ db: tauriDatabase, sessionId, agentId }).catch((error: unknown) => {
    console.warn('reading the last turn of the Lead failed', error);
    return null;
  });
