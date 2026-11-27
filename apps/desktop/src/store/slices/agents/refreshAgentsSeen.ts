import type { Agent, SessionId } from '@goodboy/types';
import { invokeAgentList } from '../../../features/workflows/workflows';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import { READ_FAILED } from '../notifications/errorRecovery';
import type { GetFn, SetFn } from './types';

type Deps = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type Params = {
  readonly sessionId: SessionId;
};

type MergeParams = {
  readonly current: ReadonlyArray<Agent>;
  readonly stored: ReadonlyArray<Agent>;
};

const latest = createLatestOnly();

const withStoredViewedAt = ({ current, stored }: MergeParams): ReadonlyArray<Agent> => {
  const storedById = new Map(stored.map((agent) => [agent.id, agent]));
  return current.map((agent) => {
    const row = storedById.get(agent.id);
    if (row === undefined) {
      return agent;
    }
    const { lastViewedAt: _viewedAt, ...rest } = agent;
    return row.lastViewedAt === undefined ? rest : { ...rest, lastViewedAt: row.lastViewedAt };
  });
};

export const refreshAgentsSeen = ({ set, get }: Deps) => {
  return async ({ sessionId }: Params): Promise<void> => {
    const claim = latest.claim({ key: sessionId });
    try {
      const stored = await invokeAgentList(sessionId);
      if (!claim.isCurrent()) {
        return;
      }
      set((state) => ({
        sessionPhaseRuns: {
          ...state.sessionPhaseRuns,
          [sessionId]: withStoredViewedAt({
            current: state.sessionPhaseRuns[sessionId] ?? [],
            stored,
          }),
        },
      }));
      void get().refreshUnreadWorkspaces();
    } catch (error) {
      if (!claim.isCurrent()) {
        return;
      }
      await get().reportError({
        recovery: READ_FAILED,
        title: "Couldn't read what you have seen in another window",
        error,
        severity: 'warning',
        sessionId,
      });
    }
  };
};
