import { listActiveResolveAttempts, listResolveAttempts, listResolveThreads } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { drainResolveQueue } from './drainResolveQueue';
import { reconcileResolveAttempts } from './reconcileResolveAttempts';
import type { SliceParams } from './types';

type SessionTaskParams = {
  readonly sessionId: SessionId;
  readonly task: () => Promise<void>;
};

type Params = SliceParams & {
  readonly runInSession: (params: SessionTaskParams) => Promise<void>;
};

export const reconcileResolveDrains = async ({ set, get, runInSession }: Params): Promise<void> => {
  const active = await listActiveResolveAttempts({ db: tauriDatabase });
  const sessionIds = new Set<SessionId>(active.map((attempt) => attempt.sessionId));
  await Promise.all(
    [...sessionIds].map((sessionId) =>
      runInSession({
        sessionId,
        task: async () => {
          await reconcileResolveAttempts({
            set,
            get,
            sessionId,
            rows: await listResolveThreads({ db: tauriDatabase, sessionId }),
            attempts: await listResolveAttempts({ db: tauriDatabase, sessionId }),
          });
          await drainResolveQueue({ set, get, sessionId });
        },
      }),
    ),
  );
};
