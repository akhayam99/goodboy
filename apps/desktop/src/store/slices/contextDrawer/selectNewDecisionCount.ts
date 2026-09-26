import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';

type Params = {
  readonly state: Pick<AppState, 'sessionEvents' | 'sessionContextSeenAt'>;
  readonly sessionId: SessionId;
};

const addedOf = (payload: unknown): number => {
  if (typeof payload !== 'object' || payload === null || !('added' in payload)) {
    return 0;
  }
  const added: unknown = payload.added;
  return typeof added === 'number' && added > 0 ? added : 0;
};

export const selectNewDecisionCount = ({ state, sessionId }: Params): number => {
  const seenAt = state.sessionContextSeenAt[sessionId];
  if (seenAt === undefined) {
    return 0;
  }
  const events = state.sessionEvents[sessionId] ?? [];
  return events.reduce((count, event) => {
    if (event.kind !== 'decisions_changed') {
      return count;
    }
    if (seenAt !== null && event.createdAt <= seenAt) {
      return count;
    }
    return count + addedOf(event.payload);
  }, 0);
};
