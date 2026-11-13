import type { SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { sessionReads } from '../../runtime/state-writes/sessionReads';
import { loadFullAgentRows, type FullAgentRowsOutcome } from '../agents/loadFullAgentRows';
import { EMPTY_LOADING } from './sessionMutators';
import type { GetFn, SetFn } from './types';

type Deps = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type Params = {
  readonly sessionId: SessionId;
};

type OpenOutcome = FullAgentRowsOutcome | 'failed';

export const openSessionAgents = ({ set, get }: Deps) => {
  return async ({ sessionId }: Params): Promise<void> => {
    const opened = sessionReads.open();
    const outcome = await loadFullAgentRows({
      set,
      get,
      sessionId,
      isWanted: opened.isCurrent,
    }).catch((error: unknown): OpenOutcome => {
      if (!opened.isCurrent()) {
        return 'dropped';
      }
      set((state) => ({
        sessionAgentsError: { ...state.sessionAgentsError, [sessionId]: formatError(error) },
      }));
      return 'failed';
    });
    if (outcome === 'stale') {
      return;
    }
    set((state) => {
      const current = state.sessionLoading[sessionId] ?? EMPTY_LOADING;
      return {
        sessionLoading: { ...state.sessionLoading, [sessionId]: { ...current, agents: false } },
      };
    });
    if (outcome !== 'applied') {
      return;
    }
    void get().recoverArtifactScouts({ sessionId });
    void get()
      .loadResolveSession({ sessionId })
      .catch((error: unknown) => {
        console.error('[resolve] load failed', formatError(error));
      });
  };
};
