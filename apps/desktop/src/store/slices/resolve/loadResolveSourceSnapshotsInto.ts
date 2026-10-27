import { listResolveThreadFacts } from '@goodboy/db';
import type { ResolveSourceSnapshot, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { CurrentParams, SetFn } from './types';

type Params = { readonly set: SetFn; readonly sessionId: SessionId } & CurrentParams;

export const loadResolveSourceSnapshotsInto = async ({
  set,
  sessionId,
  isCurrent = () => true,
}: Params): Promise<void> => {
  const facts = await listResolveThreadFacts({ db: tauriDatabase, sessionId });
  if (!isCurrent()) {
    return;
  }
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
