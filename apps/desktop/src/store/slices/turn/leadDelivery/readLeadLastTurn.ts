import type { LeadLastTurn } from '@goodboy/core/auto';
import { listSessionTurnSpans } from '@goodboy/db';
import type { AgentId, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';

type Params = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
}>;

export const readLeadLastTurn = async ({
  sessionId,
  agentId,
}: Params): Promise<LeadLastTurn | null> => {
  const spans = await listSessionTurnSpans({ db: tauriDatabase, sessionId }).catch(
    (error: unknown) => {
      console.warn('reading the last turn of the Lead failed', error);
      return [];
    },
  );
  let last: LeadLastTurn | null = null;
  for (const span of spans) {
    if (span.agentId !== agentId || (last !== null && span.endedAtMs <= last.endedAtMs)) {
      continue;
    }
    last = { endedAtMs: span.endedAtMs, model: span.model };
  }
  return last;
};
