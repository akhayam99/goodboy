import { listWorkEvents } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { tauriDatabase } from '../../../shared/lib/db';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import type { SetFn } from '../../slice-types';

const latest = createLatestOnly();

type Deps = {
  readonly set: SetFn;
};

type Params = {
  readonly sessionId: SessionId;
  readonly limit: number;
};

export const loadWorkEvents =
  ({ set }: Deps) =>
  async ({ sessionId, limit }: Params): Promise<void> => {
    const claim = latest.claim({ key: sessionId });
    try {
      const events = await listWorkEvents({ db: tauriDatabase, sessionId, limit });
      if (!claim.isCurrent()) {
        return;
      }
      set((state) => ({
        workEvents: { ...state.workEvents, [sessionId]: events },
        workEventsError: { ...state.workEventsError, [sessionId]: undefined },
      }));
    } catch (error: unknown) {
      if (!claim.isCurrent()) {
        return;
      }
      set((state) => ({
        workEventsError: { ...state.workEventsError, [sessionId]: formatError(error) },
      }));
    }
  };
