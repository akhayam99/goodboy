import { listResolveThreadFacts } from '@goodboy/db';
import type { ResolveSourceSnapshot, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { SetFn } from './types';

type Params = { readonly set: SetFn; readonly sessionId: SessionId };

export const loadResolveSourceChangesInto = async ({ set, sessionId }: Params): Promise<void> => {
  const facts = await listResolveThreadFacts({ db: tauriDatabase, sessionId });
  const changes: Record<string, ResolveSourceSnapshot> = {};
  for (const fact of facts) {
    if (fact.sourceSnapshot?.changed != null) {
      changes[fact.threadId] = fact.sourceSnapshot;
    }
  }
  set((state) => ({
    sessionResolveSourceChanges: { ...state.sessionResolveSourceChanges, [sessionId]: changes },
  }));
};
