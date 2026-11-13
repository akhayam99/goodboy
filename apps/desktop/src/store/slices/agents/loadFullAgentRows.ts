import type { SessionId } from '@goodboy/types';
import { listAgentsForSessions } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { sessionReads } from '../../runtime/state-writes/sessionReads';
import { switchEpoch } from '../workspaces/switchEpoch';
import type { GetFn, SetFn } from './types';
import { upgradeAgentRows } from './upgradeAgentRows';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly isWanted: () => boolean;
};

export type FullAgentRowsOutcome = 'applied' | 'stale' | 'dropped';

export const loadFullAgentRows = async ({
  set,
  get,
  sessionId,
  isWanted,
}: Params): Promise<FullAgentRowsOutcome> => {
  const claim = sessionReads.agents({ sessionId });
  const epoch = switchEpoch.value;
  const before = get().sessionPhaseRuns[sessionId];
  const isCurrent = (): boolean => claim.isCurrent() && switchEpoch.value === epoch;
  const bySession = await listAgentsForSessions(tauriDatabase, [sessionId]).catch(
    (error: unknown) => {
      if (isCurrent()) {
        throw error;
      }
      return null;
    },
  );
  if (bySession === null || !isCurrent()) {
    return 'stale';
  }
  if (!isWanted()) {
    return 'dropped';
  }
  const full = bySession.get(sessionId) ?? [];
  set((state) => {
    const now = state.sessionPhaseRuns[sessionId];
    if (state.lightAgentSessions[sessionId] !== true || now === undefined || before === undefined) {
      return {};
    }
    const lightAgentSessions = { ...state.lightAgentSessions };
    const sessionAgentsError = { ...state.sessionAgentsError };
    Reflect.deleteProperty(lightAgentSessions, sessionId);
    Reflect.deleteProperty(sessionAgentsError, sessionId);
    return {
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [sessionId]: upgradeAgentRows({ before, now, full }),
      },
      lightAgentSessions,
      sessionAgentsError,
    };
  });
  return 'applied';
};
