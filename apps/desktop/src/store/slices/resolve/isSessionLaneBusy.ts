import { listResolveAttempts } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { laneHolderOf, laneQueueOf, lanePathsOf } from './resolveLane';
import type { AppStore } from '../../store';
import type { SessionParams } from './types';

type Params = SessionParams & { readonly get: () => Pick<AppStore, 'sessionPhaseRuns'> };

export const isSessionLaneBusy = async ({ get, sessionId }: Params): Promise<boolean> => {
  const attempts = await listResolveAttempts({ db: tauriDatabase, sessionId });
  const agents = get().sessionPhaseRuns[sessionId] ?? [];
  return lanePathsOf({ attempts }).some(
    (worktreePath) =>
      laneHolderOf({ attempts, agents, worktreePath }) !== null ||
      laneQueueOf({ attempts, worktreePath }).length > 0,
  );
};
