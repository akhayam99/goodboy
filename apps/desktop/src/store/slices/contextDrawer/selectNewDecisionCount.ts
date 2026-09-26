import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';

type Params = {
  readonly state: Pick<AppState, 'sessionEvents' | 'sessionContextSeenAt'>;
  readonly sessionId: SessionId;
};

const countOf = (payload: unknown, key: 'added' | 'replaced'): number => {
  if (typeof payload !== 'object' || payload === null || !(key in payload)) {
    return 0;
  }
  const value: unknown = (payload as Readonly<Record<string, unknown>>)[key];
  return typeof value === 'number' && value > 0 ? value : 0;
};

const newOf = (payload: unknown): number =>
  countOf(payload, 'added') + countOf(payload, 'replaced');

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
    return count + newOf(event.payload);
  }, 0);
};
