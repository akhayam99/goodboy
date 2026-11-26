import type { SessionId } from '@goodboy/types';
import { listAgentRunIdsForSession, listAgentTurnSpanRoutes } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { READ_FAILED } from '../notifications/errorRecovery';
import { seedRunRoutingFromSpans } from '../turn/seedRunRoutingFromSpans';
import { switchEpoch } from '../workspaces/switchEpoch';
import { mergeRunHistory } from './mergeRunHistory';
import type { GetFn, SetFn } from './types';

type Deps = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type Params = {
  readonly sessionId: SessionId;
};

export const loadSessionRunHistory = ({ set, get }: Deps) => {
  return async ({ sessionId }: Params): Promise<void> => {
    const epoch = switchEpoch.value;
    try {
      const [eventRunIds, routes] = await Promise.all([
        listAgentRunIdsForSession(tauriDatabase, sessionId),
        listAgentTurnSpanRoutes({ db: tauriDatabase, sessionId }),
      ]);
      if (switchEpoch.value !== epoch) {
        return;
      }
      set((state) => ({
        agentRunHistory: mergeRunHistory({ history: state.agentRunHistory, eventRunIds, routes }),
        runRouting: seedRunRoutingFromSpans({ runRouting: state.runRouting, routes }),
      }));
    } catch (error) {
      if (switchEpoch.value !== epoch) {
        return;
      }
      await get().reportError({
        recovery: READ_FAILED,
        title: "Couldn't load the earlier runs",
        error,
        sessionId,
        coalesceKey: `run-history-load:${sessionId}`,
      });
    }
  };
};
