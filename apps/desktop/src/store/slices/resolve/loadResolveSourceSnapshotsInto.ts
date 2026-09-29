import { listResolveThreadFacts } from '@goodboy/db';
import type { ResolveSourceSnapshot, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

type Params = { readonly set: SetFn; readonly sessionId: SessionId };

export const loadResolveSourceSnapshotsInto = async ({ set, sessionId }: Params): Promise<void> => {
  const facts = await listResolveThreadFacts({ db: tauriDatabase, sessionId });
  const snapshots: Record<string, ResolveSourceSnapshot> = {};
  for (const fact of facts) {
    if (fact.sourceSnapshot !== null) {
      snapshots[fact.threadId] = fact.sourceSnapshot;
    }
  }
  set((state) => ({
    sessionResolveSourceSnapshots: {
      ...state.sessionResolveSourceSnapshots,
      [sessionId]: snapshots,
    },
  }));
};
