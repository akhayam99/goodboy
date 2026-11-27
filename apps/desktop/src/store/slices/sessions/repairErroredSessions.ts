import { failureStandingOf } from '@goodboy/core/attention';
import { listAgentsForSessions } from '@goodboy/db';
import { listErroredSessionIds, repairSessionErrorState } from '@goodboy/db/session-error-repair';
import { tauriDatabase } from '../../../shared/lib/db';

export const repairErroredSessions = async (): Promise<number> => {
  try {
    const sessionIds = await listErroredSessionIds({ db: tauriDatabase });
    if (sessionIds.length === 0) {
      return 0;
    }
    const agentsBySession = await listAgentsForSessions(tauriDatabase, sessionIds);
    let repaired = 0;
    for (const sessionId of sessionIds) {
      const standing = failureStandingOf({ agents: agentsBySession.get(sessionId) ?? [] });
      if (!standing.isEnded) {
        continue;
      }
      if (await repairSessionErrorState({ db: tauriDatabase, sessionId })) {
        repaired += 1;
      }
    }
    return repaired;
  } catch (error) {
    console.error('repair the stale session errors failed', error);
    return 0;
  }
};
