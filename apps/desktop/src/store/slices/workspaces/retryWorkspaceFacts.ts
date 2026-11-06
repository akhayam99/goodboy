import type { WorkspaceId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { tauriDatabase } from '../../../shared/lib/db';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import { loadWorkspaceFacts } from './loadWorkspaceFacts';
import { switchEpoch } from './switchEpoch';
import type { GetFn, SetFn } from './types';
import { workspaceFactsPatchOf } from './workspaceFactsPatchOf';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type Input = {
  readonly workspaceId: WorkspaceId;
};

export const retryWorkspaceFacts = ({ set, get }: Params) => {
  const latest = createLatestOnly();
  return async ({ workspaceId }: Input): Promise<void> => {
    const claimed = latest.claim({ key: workspaceId });
    const epoch = switchEpoch.value;
    const isCurrent = (): boolean =>
      claimed.isCurrent() &&
      epoch === switchEpoch.value &&
      get().currentWorkspaceId === workspaceId;
    const state = get();
    try {
      const facts = await loadWorkspaceFacts({
        db: tauriDatabase,
        sessionIds: state.sessions.map((session) => session.id),
        sessionPhaseRuns: state.sessionPhaseRuns,
        kindOverride: state.agentKindOverride,
      });
      if (!isCurrent()) {
        return;
      }
      set((current) => ({
        ...workspaceFactsPatchOf({ state: current, facts }),
        workspaceFactsError: null,
      }));
    } catch (error) {
      if (!isCurrent()) {
        return;
      }
      set({ workspaceFactsError: formatError(error) });
    }
  };
};
