import {
  listClusterAttemptsForSessions,
  listClusterExecutionEligibilityForSessions,
} from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { clusterAttemptLedgerPatch } from './mergeClusterAttempt';
import type { ClusterAttemptsState } from './state';

type Params = {
  readonly sessionIds: ReadonlyArray<SessionId>;
};

export const loadClusterAttemptLedgers = async ({
  sessionIds,
}: Params): Promise<ClusterAttemptsState> => {
  const [attempts, eligibility] = await Promise.all([
    listClusterAttemptsForSessions({ db: tauriDatabase, sessionIds }),
    listClusterExecutionEligibilityForSessions({ db: tauriDatabase, sessionIds }),
  ]);
  return clusterAttemptLedgerPatch({ sessionIds, attempts, eligibility });
};
